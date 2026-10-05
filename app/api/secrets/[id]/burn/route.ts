import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import crypto from 'crypto';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await _request.json().catch(() => { });
    const passcode = typeof body?.passcode === "string" ? body.passcode.trim() : null;

    const rawLink = await redis.get<string | object>(`secret:link:${id}`);

    if (!rawLink) {
      return NextResponse.json(
        { error: "Secret has already self-destructed or expired." },
        { status: 404 },
      );
    }

    const linkData = typeof rawLink === "string" ? JSON.parse(rawLink) : rawLink;

    const { masterId, burnOnRead, passcodeHash, passcodeSalt } = linkData;

    if (passcodeHash) {
      const computeHash = passcode && passcodeSalt ? crypto.createHash("sha256").update(passcode + passcodeSalt).digest("hex") : "";

      const computeBuf = Buffer.from(computeHash, 'utf-8');
      const passcodeBuf = Buffer.from(passcodeHash, 'utf-8');

      if (!passcode || computeBuf.length !== passcodeBuf.length || !crypto.timingSafeEqual(computeBuf, passcodeBuf)) {
        const strikes = (linkData.strikes || 0) + 1;
        linkData.strikes = strikes;


        if (strikes >= 3) {
          await redis.del(`secret:link:${id}`);
          await redis.srem(`secret:refs:${masterId}`, id);


          const remainingRefs = await redis.scard(`secret:refs:${masterId}`);
          if (remainingRefs === 0) {
            await redis.del(`secret:payload:${masterId}`);
            await redis.del(`secret:refs:${masterId}`);
            await redis.del(`secret:revoke:${masterId}`);
          }
          return NextResponse.json(
            { error: "Maximum attempts reached. Secret destroyed." },
            { status: 410 },
          );
        }

        const ttlRemaining = await redis.ttl(`secret:link:${id}`);
        await redis.set(`secret:link:${id}`, JSON.stringify(linkData), {
          ex: Math.max(1, ttlRemaining),
        });
        return NextResponse.json(
          { error: "Incorrect passcode", remainingStrikes: 3 - strikes },
          { status: 401 },
        );


      }
    }

    if (burnOnRead) {
      await redis.del(`secret:link:${id}`);
      await redis.srem(`secret:refs:${masterId}`, id);
    }

    const rawPayload = await redis.get<string | object>(`secret:payload:${masterId}`);

    if (!rawPayload) {
      return NextResponse.json({ error: "Master payload expired or destroyed." }, { status: 404 });
    }
    const payload = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

    if (burnOnRead) {
      const remaining = await redis.scard(`secret:refs:${masterId}`);
      if (remaining === 0) {
        await redis.del(`secret:payload:${masterId}`);
        await redis.del(`secret:refs:${masterId}`);
        await redis.del(`secret:revoke:${masterId}`);
      }
    }


    return NextResponse.json(
      { ciphertext: payload.ciphertext, iv: payload.iv, burnOnRead: Boolean(burnOnRead) },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

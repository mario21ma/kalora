import { z } from 'zod';
import {offProduct} from '@/lib/off-product';

export const runtime = 'nodejs';

const codeSchema = z.string().regex(/^\d{8,14}$/);

function upstreamError(status: number) {
  if (status === 429) return 'Open Food Facts je privremeno ograničio broj upita. Pokušaj ponovno za minutu.';
  if (status === 503) return 'Open Food Facts je trenutačno preopterećen. Pokušaj ponovno za nekoliko trenutaka.';
  if (status >= 500) return 'Open Food Facts trenutačno nije dostupan. Pokušaj ponovno malo kasnije.';
  return `Open Food Facts nije odgovorio kako treba (HTTP ${status}).`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = codeSchema.parse(url.searchParams.get('code') || '');
    const fields = 'code,product_name,brands,nutriments,serving_size,quantity,categories_tags,nutrition_data_per';
    const contact =
      process.env.OPENFOODFACTS_CONTACT_EMAIL ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
      'support@kalora.app';

    const endpoint = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${encodeURIComponent(fields)}`;
    const r = await fetch(endpoint, {
      headers: {
        'User-Agent': `Kalora/1.2 (${contact})`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      return Response.json({ error: upstreamError(r.status) }, { status: 502 });
    }

    const data = await r.json();
    if (data?.status !== 1 || !data?.product) {
      return Response.json({ error: 'Proizvod nije pronađen po tom barkodu.' }, { status: 404 });
    }

    try {
      return Response.json({code,...offProduct(data.product)});
    } catch(e) {
      return Response.json({error:e instanceof Error?e.message:'Neispravni podaci proizvoda.'},{status:422});
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: 'Neispravan barkod.' }, { status: 400 });
    }

    if (e instanceof Error && e.name === 'TimeoutError') {
      return Response.json(
        { error: 'Open Food Facts nije odgovorio na vrijeme. Pokušaj ponovno.' },
        { status: 504 },
      );
    }

    return Response.json(
      { error: e instanceof Error ? e.message : 'Greška pri dohvaćanju proizvoda.' },
      { status: 500 },
    );
  }
}

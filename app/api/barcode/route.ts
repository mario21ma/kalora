import { z } from 'zod';

export const runtime = 'nodejs';

const codeSchema = z.string().regex(/^\d{8,14}$/);
const n = (value: unknown) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : NaN;
};

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
    const fields = 'code,product_name,brands,nutriments,serving_size';
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

    const p = data.product;
    const nut = p.nutriments || {};

    let calories = n(nut['energy-kcal_100g']);
    if (!Number.isFinite(calories)) {
      const kj = n(nut['energy-kj_100g'] ?? nut['energy_100g']);
      if (Number.isFinite(kj)) calories = kj / 4.184;
    }

    const protein = n(nut.proteins_100g);
    const carbs = n(nut.carbohydrates_100g);
    const fat = n(nut.fat_100g);
    const fiber = n(nut.fiber_100g);

    if (!p.product_name) {
      return Response.json({ error: 'Proizvod postoji, ali nema upisan naziv.' }, { status: 422 });
    }

    if (![calories, protein, carbs, fat].every(Number.isFinite)) {
      return Response.json(
        { error: 'Proizvod postoji, ali nutritivni podaci nisu dovoljno potpuni.' },
        { status: 422 },
      );
    }

    const servingMatch = String(p.serving_size || '')
      .replace(',', '.')
      .match(/(\d+(?:\.\d+)?)\s*g\b/i);
    const serving = servingMatch
      ? Math.min(5000, Math.max(1, Number(servingMatch[1])))
      : 100;

    return Response.json({
      code,
      name: String(p.product_name).slice(0, 150),
      brand: String(p.brands || '').split(',')[0].trim().slice(0, 100),
      serving,
      calories: Math.max(0, calories),
      protein: Math.max(0, protein),
      carbs: Math.max(0, carbs),
      fat: Math.max(0, fat),
      fiber: Number.isFinite(fiber) ? Math.max(0, fiber) : 0,
    });
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

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase, supabaseAdmin } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

const isVercel = Boolean(
  process.env.VERCEL ||
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);
const DATA_DIR = isVercel
  ? path.join(os.tmpdir(), '.data')
  : path.join(process.cwd(), '.data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {}
}

function loadMenuFromFile() {
  try {
    if (fs.existsSync(MENU_FILE)) {
      const raw = fs.readFileSync(MENU_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return null;
}

function saveMenuToFile(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(MENU_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

async function syncWithSupabase(updatePayload) {
  try {
    const supaClient = supabaseAdmin || supabase;
    const supaPromise = supaClient
      .from('app_state')
      .update(updatePayload)
      .eq('id', 'tronos');

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout syncWithSupabase (4s)')), 4000)
    );

    const res = await Promise.race([supaPromise, timeoutPromise]);
    if (!res?.error) {
      return { success: true, attempts: 1 };
    }
    console.warn('[API/menu] Supabase update error:', res?.error?.message);
  } catch (err) {
    console.warn('[API/menu] Exception updating Supabase:', err?.message);
  }
  return { success: false, attempts: 1 };
}

// ── GET /api/menu ────────────────────────────────────────────────────
export async function GET() {
  try {
    const localMenu = loadMenuFromFile();
    if (localMenu && localMenu.length > 0) {
      return NextResponse.json({ menu: localMenu, source: 'local_file' });
    }

    const { data, error } = await supabase
      .from('app_state')
      .select('menu_data, config_data')
      .eq('id', 'tronos')
      .single();

    if (!error && data) {
      if (data.menu_data && Array.isArray(data.menu_data)) {
        saveMenuToFile(data.menu_data);
      }
      return NextResponse.json({ menu: data.menu_data, config: data.config_data, source: 'supabase' });
    }

    return NextResponse.json({ menu: null });
  } catch (e) {
    console.error('[API/menu] GET error:', e);
    return NextResponse.json({ error: 'Error al obtener menú' }, { status: 500 });
  }
}

// ── POST /api/menu ───────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, menu_data, config_data } = body;

    const updatePayload = {};

    if (Array.isArray(menu_data)) {
      saveMenuToFile(menu_data);
      updatePayload.menu_data = menu_data;
    }

    if (config_data && typeof config_data === 'object') {
      updatePayload.config_data = config_data;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No hay datos para actualizar' }, { status: 400 });
    }

    const { success, attempts } = await syncWithSupabase(updatePayload);

    return NextResponse.json({
      ok: true,
      supabaseSynced: success,
      attempts,
      localSaved: Array.isArray(menu_data),
    });
  } catch (e) {
    console.error('[API/menu] POST error:', e);
    return NextResponse.json({ error: 'Error procesando solicitud de menú' }, { status: 500 });
  }
}

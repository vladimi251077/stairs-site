const DEFAULT_TURNKEY_COEFFICIENT = 2.35;

const RAILING_ENGINE_IDS_BY_NAME = {
  'трубки 16 мм': 'rail_tubes_16',
  'квадратные балясины': 'rail_square_balusters',
  'фрезерованные балясины': 'rail_milled_balusters',
  'стекло': 'rail_glass',
  'металл': 'rail_metal',
  'дерево': 'rail_wood',
  'комбинированные': 'rail_combined'
};

export function normalizeSupabaseMaterialsCatalog(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && row.active !== false && row.code && row.name)
    .map((row) => ({
      id: row.id || row.code,
      code: row.code,
      name: row.name,
      unit: row.unit,
      category: row.category,
      baseCost: Number(row.base_cost || 0),
      wastePercent: Number(row.waste_percent || 0),
      active: row.active !== false,
      visibleToClient: !!row.visible_to_client,
      sortOrder: Number(row.sort_order || 100)
    }));
}

export function normalizeSupabaseRailingTypes(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && row.active !== false && row.name)
    .map((row) => {
      const normalizedName = normalizeRailingName(row.name);
      const knownEngineId = RAILING_ENGINE_IDS_BY_NAME[normalizedName];

      return {
        id: knownEngineId || row.id || slugFromName(row.name),
        databaseId: row.id,
        name: row.name,
        pricePerMeter: Number(row.price_per_meter || 0),
        description: row.description || '',
        active: row.active !== false,
        visibleToClient: row.visible_to_client !== false,
        sortOrder: Number(row.sort_order || 100)
      };
    });
}

export function normalizeQuantityEngineSettings(row) {
  const parsedCoefficient = Number(row?.turnkey_coefficient ?? row?.turnkeyCoefficient ?? DEFAULT_TURNKEY_COEFFICIENT);
  const turnkeyCoefficient = Number.isFinite(parsedCoefficient) && parsedCoefficient >= 1
    ? parsedCoefficient
    : DEFAULT_TURNKEY_COEFFICIENT;

  if (row && parsedCoefficient !== turnkeyCoefficient) {
    console.warn('quantity_engine_settings turnkey_coefficient is invalid; built-in default was used.');
  }

  return {
    turnkeyCoefficient
  };
}

export function buildQuantityEngineRuntimeOptions(runtimeState = {}) {
  const settings = normalizeQuantityEngineSettings(runtimeState.settings);
  const materialsCatalog = Array.isArray(runtimeState.materialsCatalog) ? runtimeState.materialsCatalog : [];
  const railingTypes = Array.isArray(runtimeState.railingTypes) ? runtimeState.railingTypes : [];
  const quantityEngineOptions = {};

  if (runtimeState.loadedFromSupabase && materialsCatalog.length > 0) {
    quantityEngineOptions.materialsCatalog = materialsCatalog;
  }

  if (runtimeState.loadedFromSupabase && railingTypes.length > 0) {
    quantityEngineOptions.railingTypes = railingTypes;
  }

  return {
    turnkeyCoefficient: settings.turnkeyCoefficient,
    quantityEngineOptions
  };
}

function normalizeRailingName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugFromName(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');

  return slug ? `rail_${slug}` : 'rail_custom';
}

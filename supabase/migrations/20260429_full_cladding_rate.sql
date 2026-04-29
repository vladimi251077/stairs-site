insert into public.scenario_rate_rows (rate_group, rate_key, label, rate, sort_order, active)
values ('service', 'fullCladdingPerM2', 'Полная обшивка каркаса за м²', 6500, 43, true)
on conflict (rate_group, rate_key) do update
set label = excluded.label,
    rate = excluded.rate,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = timezone('utc', now());

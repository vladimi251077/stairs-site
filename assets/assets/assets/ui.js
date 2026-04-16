const client = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

async function loadProjects() {
  const { data, error } = await client
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  const root = document.getElementById("projects");

  if (!data) return;

  root.innerHTML = data.map(p => `
    <div class="card">
      <img src="${p.cover_image || '/logo.jpg.png'}">
      <h3>${p.title || 'Проект'}</h3>
    </div>
  `).join('');
}

loadProjects();

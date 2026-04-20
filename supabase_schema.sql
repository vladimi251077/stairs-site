-- Таблица материалов каркаса
create table frame_materials (
    id uuid default uuid_generate_v4() primary key,
    value text not null unique,
    label text not null,
    description text,
    extra_price integer default 0,
    active boolean default true
);

insert into frame_materials (value, label, description, extra_price) values
    ('metal', 'Металлокаркас', 'Высокая жёсткость', 0),
    ('concrete', 'Бетонный каркас', 'Монолитное основание', 42000),
    ('wood', 'Деревянный каркас', 'Тёплая фактура', 26000);

-- Таблица облицовки
create table cladding_types (
    id uuid default uuid_generate_v4() primary key,
    value text not null unique,
    label text not null,
    extra_price integer default 0,
    active boolean default true
);

insert into cladding_types (value, label, extra_price) values
    ('none', 'Без облицовки', -30000),
    ('standard', 'Стандарт', 0),
    ('premium', 'Премиум', 52000);

-- Таблица ограждений
create table railing_types (
    id uuid default uuid_generate_v4() primary key,
    value text not null unique,
    label text not null,
    extra_price integer default 0,
    active boolean default true
);

insert into railing_types (value, label, extra_price) values
    ('none', 'Без ограждения', 0),
    ('metal', 'Металл', 0),
    ('glass', 'Стекло', 38000),
    ('wood', 'Дерево', 21000);

-- Таблица уровней финиша
create table finish_levels (
    id uuid default uuid_generate_v4() primary key,
    value text not null unique,
    label text not null,
    extra_price integer default 0,
    active boolean default true
);

insert into finish_levels (value, label, extra_price) values
    ('basic', 'Базовый', 0),
    ('standard', 'Стандарт', 18000),
    ('premium', 'Премиум', 48000);

-- Пример структуры projects
create table projects (
    id uuid default uuid_generate_v4() primary key,
    title text,
    short_description text,
    full_description text,
    price_from integer,
    price_to integer,
    staircase_type text,
    materials text,
    category text,
    lead_time text,
    slug text,
    created_at timestamp default now(),
    updated_at timestamp default now()
);

create table project_images (
    id uuid default uuid_generate_v4() primary key,
    project_id uuid references projects(id),
    image_url text,
    alt_text text,
    is_cover boolean default false,
    sort_order integer
);

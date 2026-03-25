-- ══════════════════════════════════════════════
--  READING TRACKER — Supabase SQL Setup
--  Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════

-- 1. Tabla de libros
CREATE TABLE books (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  total_pages INTEGER,
  cover       TEXT,           -- base64 o URL
  status      TEXT NOT NULL DEFAULT 'progress',  -- 'progress' | 'done'
  finished_at TEXT,           -- YYYY-MM-DD
  created_at  TEXT NOT NULL
);

-- 2. Tabla de registros de lectura
CREATE TABLE logs (
  id         TEXT PRIMARY KEY,
  book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,   -- YYYY-MM-DD
  page       INTEGER NOT NULL
);

-- ══════════════════════════════════════════════
--  Row Level Security (RLS)
--  Sin autenticación: acceso público (solo vos
--  conocés la URL, no hay datos sensibles)
-- ══════════════════════════════════════════════

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs  ENABLE ROW LEVEL SECURITY;

-- Política: acceso total (anon key)
CREATE POLICY "public access books" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public access logs"  ON logs  FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
--  Seed: tus datos históricos
-- ══════════════════════════════════════════════

INSERT INTO books (id, name, total_pages, status, finished_at, created_at) VALUES
  ('b1', 'Hábitos atómicos',            203, 'done', '2025-02-09', '2025-01-21'),
  ('b2', 'HP: La piedra filosofal',      308, 'done', '2025-02-17', '2025-02-10'),
  ('b3', 'HP: La cámara secreta',        348, 'done', '2025-02-27', '2025-02-17'),
  ('b4', 'HP: El prisionero de Azkaban', 421, 'done', '2025-03-10', '2025-03-01');

INSERT INTO logs (id, book_id, date, page) VALUES
  -- Hábitos atómicos
  ('l01','b1','2025-01-21',45),
  ('l02','b1','2025-01-22',76),
  ('l03','b1','2025-01-23',100),
  ('l04','b1','2025-01-27',110),
  ('l05','b1','2025-01-28',136),
  ('l06','b1','2025-02-02',153),
  ('l07','b1','2025-02-03',163),
  ('l08','b1','2025-02-04',190),
  ('l09','b1','2025-02-07',195),
  ('l10','b1','2025-02-08',203),
  ('l11','b1','2025-02-09',203),
  -- HP: La piedra filosofal
  ('l12','b2','2025-02-10',52),
  ('l13','b2','2025-02-11',66),
  ('l14','b2','2025-02-12',92),
  ('l15','b2','2025-02-13',165),
  ('l16','b2','2025-02-14',194),
  ('l17','b2','2025-02-15',203),
  ('l18','b2','2025-02-16',265),
  ('l19','b2','2025-02-17',308),
  -- HP: La cámara secreta
  ('l20','b3','2025-02-17',31),
  ('l21','b3','2025-02-19',49),
  ('l22','b3','2025-02-22',170),
  ('l23','b3','2025-02-23',208),
  ('l24','b3','2025-02-24',247),
  ('l25','b3','2025-02-25',257),
  ('l26','b3','2025-02-26',313),
  ('l27','b3','2025-02-27',348),
  -- HP: El prisionero de Azkaban
  ('l28','b4','2025-03-01',99),
  ('l29','b4','2025-03-03',125),
  ('l30','b4','2025-03-04',142),
  ('l31','b4','2025-03-06',182),
  ('l32','b4','2025-03-08',325),
  ('l33','b4','2025-03-09',394),
  ('l34','b4','2025-03-10',421);

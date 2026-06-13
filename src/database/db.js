// Подключаем библиотеку для работы с SQLite базой данных
const Database = require("better-sqlite3");
// Подключаем модули для работы с путями и файлами
const path = require("path");
const fs = require("fs");
// Подключаем логгер
const logger = require("../utils/logger");
// Подключаем dotenv для переменных окружения
require("dotenv").config();

// ==================== ПЕРЕМЕННЫЕ ====================
let db = null; // Объект подключения к БД
let isConnected = false; // Флаг: подключены ли к БД

// ==================== ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ====================
/**
 * Устанавливает соединение с SQLite базой данных
 * Создаёт файл database.sqlite если его нет
 * Включает нужные режимы для производительности и безопасности
 */
function connectDB() {
  try {
    // Если уже подключены - просто возвращаем объект
    if (isConnected) return db;

    // Определяем путь к файлу БД (из .env или по умолчанию)
    const dbPath = path.resolve(process.env.DB_PATH || "./database.sqlite");
    // Путь для бэкапов
    const backupPath = path.resolve(process.env.DB_BACKUP_PATH || "./backups");

    // Создаём папку для бэкапов, если её нет
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Подключаемся к базе данных
    db = new Database(dbPath);

    // Включаем поддержку внешних ключей (для связей между таблицами)
    db.pragma("foreign_keys = ON");

    // WAL режим - позволяет одновременно читать и писать в БД
    db.pragma("journal_mode = WAL");

    // Таймаут при блокировке (5 секунд)
    db.pragma("busy_timeout = 5000");

    // Строгий режим проверки типов данных
    db.pragma("strict = ON");

    isConnected = true;

    logger.info("Database connected successfully", { path: dbPath });

    // Запускаем создание таблиц (миграции)
    runMigrations();

    return db;
  } catch (error) {
    logger.error("Failed to connect to database:", error);
    throw error;
  }
}

// ==================== СОЗДАНИЕ ТАБЛИЦ (МИГРАЦИИ) ====================
/**
 * Создаёт все необходимые таблицы в базе данных
 * Выполняется только один раз при первом запуске
 */
function runMigrations() {
  try {
    if (!isConnected) connectDB();

    // Таблица для отслеживания выполненных миграций
    db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // Название нашей миграции
    const migrationName = "initial_schema_v1";
    // Проверяем, выполнялась ли уже эта миграция
    const existing = db
      .prepare("SELECT id FROM migrations WHERE name = ?")
      .get(migrationName);

    // Если миграция ещё не выполнялась - создаём таблицы
    if (!existing) {
      logger.info("Running initial database migration...");

      // Транзакция - либо всё создастся, либо ничего
      const createTables = db.transaction(() => {
        // ===== ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ =====
        db.exec(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vk_id INTEGER UNIQUE NOT NULL,           -- ID пользователя в VK
                        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'class_teacher', 'kitchen', 'parent')),
                        city_id INTEGER,                          -- ID города
                        school_id INTEGER,                        -- ID школы
                        class_name TEXT,                          -- Класс
                        child_name TEXT,                          -- Имя ребёнка (для родителей)
                        shift TEXT DEFAULT '1' CHECK(shift IN ('1', '2')),  -- Смена
                        is_active BOOLEAN DEFAULT 1,              -- Активен/заблокирован
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
                        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
                    )
                `);

        // ===== ТАБЛИЦА ГОРОДОВ =====
        db.exec(`
                    CREATE TABLE IF NOT EXISTS cities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,                -- Название города
                        created_by INTEGER NOT NULL,              -- Кто создал
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
                    )
                `);

        // ===== ТАБЛИЦА ШКОЛ =====
        db.exec(`
                    CREATE TABLE IF NOT EXISTS schools (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,                       -- Название школы
                        city_id INTEGER NOT NULL,                 -- Город
                        order_deadline_time TEXT DEFAULT '20:00', -- Время截止 заказов
                        created_by INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
                        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
                        UNIQUE(name, city_id)
                    )
                `);

        // ===== ТАБЛИЦА МЕНЮ =====
        db.exec(`
                    CREATE TABLE IF NOT EXISTS menus (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        city_id INTEGER NOT NULL,
                        school_id INTEGER NOT NULL,
                        date DATE NOT NULL,                       -- Дата меню
                        items JSON NOT NULL,                      -- Блюда в формате JSON
                        created_by INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
                        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
                        UNIQUE(school_id, date)                   -- Одно меню на школу на дату
                    )
                `);

        // ===== ТАБЛИЦА ЗАКАЗОВ =====
        db.exec(`
                    CREATE TABLE IF NOT EXISTS orders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        menu_id INTEGER NOT NULL,
                        order_date DATE NOT NULL,
                        items JSON NOT NULL,
                        total_price DECIMAL(10,2) NOT NULL,
                        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'confirmed', 'completed', 'cancelled')),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE RESTRICT,
                        UNIQUE(user_id, menu_id)                  -- Один заказ на пользователя на меню
                    )
                `);

        // ===== ИНДЕКСЫ ДЛЯ БЫСТРОГО ПОИСКА =====
        db.exec(`
                    CREATE INDEX IF NOT EXISTS idx_users_vk_id ON users(vk_id);
                    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
                    CREATE INDEX IF NOT EXISTS idx_menus_date ON menus(date);
                    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
                `);

        // Отмечаем миграцию как выполненную
        db.prepare("INSERT INTO migrations (name) VALUES (?)").run(
          migrationName,
        );
      });

      // Выполняем транзакцию
      createTables();

      // Заполняем начальными данными (город, школа)
      seedInitialData();

      logger.info("Database migration completed successfully");
    } else {
      logger.info("Database schema already up to date");
    }
  } catch (error) {
    logger.error("Migration failed:", error);
    throw error;
  }
}

// ==================== НАЧАЛЬНЫЕ ДАННЫЕ ====================
/**
 * Заполняет базу данных начальными данными:
 * - системный администратор
 * - город Красноярск
 * - школа №93
 */
function seedInitialData() {
  try {
    if (!isConnected) connectDB();

    // Проверяем, есть ли уже города в базе
    const cityCount = db.prepare("SELECT COUNT(*) as count FROM cities").get();

    if (cityCount.count === 0) {
      logger.info("Seeding initial data...");

      // Создаём системного администратора (vk_id = 0)
      const insertUser = db.prepare(
        `INSERT INTO users (vk_id, role, is_active) VALUES (?, ?, ?)`,
      );
      const systemUser = insertUser.run(0, "admin", 1);
      const systemUserId = systemUser.lastInsertRowid;

      // Добавляем город Красноярск
      const insertCity = db.prepare(
        `INSERT INTO cities (name, created_by) VALUES (?, ?)`,
      );
      const city = insertCity.run("Красноярск", systemUserId);
      const cityId = city.lastInsertRowid;

      // Добавляем школу №93
      const insertSchool = db.prepare(
        `INSERT INTO schools (name, city_id, order_deadline_time, created_by) VALUES (?, ?, ?, ?)`,
      );
      insertSchool.run("Школа №93", cityId, "20:00", systemUserId);

      logger.info("Initial data seeded successfully", { cityId, systemUserId });
    }
  } catch (error) {
    logger.error("Failed to seed initial data:", error);
    throw error;
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
/**
 * Подготавливает SQL запрос к выполнению
 * @param {string} sql - SQL запрос с плейсхолдерами (?)
 * @returns {object} - подготовленный запрос
 */
function prepare(sql) {
  if (!isConnected) connectDB();
  return db.prepare(sql);
}

/**
 * Закрывает соединение с базой данных
 */
function closeDB() {
  if (isConnected && db) {
    db.close();
    isConnected = false;
    logger.info("Database connection closed");
  }
}

// Экспортируем функции для использования в других файлах
module.exports = {
  connectDB, // Подключение к БД
  prepare, // Подготовка SQL запросов
  closeDB, // Закрытие соединения
  getDb: () => db, // Получить объект БД (для особых случаев)
  isConnected: () => isConnected, // Проверить, подключены ли
};

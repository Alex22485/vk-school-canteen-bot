// ==================== src/handlers/kitchen.js ====================
// Обработчик для сотрудника кухни (создание меню)

const { prepare } = require("../database/db");

/**
 * Проверка, что пользователь имеет роль kitchen
 */
function isKitchen(user) {
  return user && user.role === "kitchen";
}

/**
 * Показать панель кухни
 */
async function showKitchenPanel(userId, sendMessage, createKeyboard) {
  const keyboard = createKeyboard([
    [{ label: "📅 Создать меню", cmd: "kitchen_create_menu" }],
    [{ label: "📋 Мои меню", cmd: "kitchen_my_menus" }],
    [{ label: "🔙 Главное меню", cmd: "main_menu" }],
  ]);

  await sendMessage(
    userId,
    `🍳 **Панель кухни**\n\nВыберите действие:`,
    keyboard,
  );
}

/**
 * Начать создание меню — запрос даты
 */
async function startCreateMenu(userId, sendMessage, createKeyboard) {
  // Сохраняем состояние в сессии
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);

  session.kitchenMenu = {
    step: "date",
    date: null,
    items: [],
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const exampleDate = tomorrow
    .toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, ".");

  await sendMessage(
    userId,
    `📅 **Создание меню**\n\n` +
      `⏰ **Важно:** Меню можно создавать только на завтра и более поздние дни!\n\n` +
      `Введите дату в формате **ДД.ММ.ГГГГ**\n` +
      `Например: ${exampleDate}`,
    null,
  );
}

/**
 * Валидация даты (не раньше завтрашнего дня)
 */
function validateDate(dateStr) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return {
      valid: false,
      error: "❌ Неверный формат. Используйте ДД.ММ.ГГГГ",
    };
  }

  const [day, month, year] = dateStr.split(".").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (selectedDate < tomorrow) {
    return {
      valid: false,
      error: "❌ Меню можно создавать только на завтра и более поздние дни",
    };
  }

  return {
    valid: true,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    displayDate: dateStr,
  };
}

/**
 * Обработка даты и переход к вводу блюд
 */
async function handleMenuDate(userId, text, sendMessage, createKeyboard) {
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);

  if (!session.kitchenMenu || session.kitchenMenu.step !== "date") return false;

  const validation = validateDate(text);
  if (!validation.valid) {
    await sendMessage(userId, `${validation.error}\n\nПопробуйте еще раз:`);
    return true;
  }

  session.kitchenMenu.date = validation.date;
  session.kitchenMenu.displayDate = validation.displayDate;
  session.kitchenMenu.step = "items";
  session.kitchenMenu.items = [];

  const keyboard = createKeyboard([
    [{ label: "✅ Завершить и сохранить", cmd: "kitchen_finish" }],
    [{ label: "❌ Отменить", cmd: "kitchen_cancel" }],
  ]);

  await sendMessage(
    userId,
    `✅ Дата установлена: **${validation.displayDate}**\n\n` +
      `📝 **Введите блюда**\n\n` +
      `Каждое блюдо с новой строки в формате:\n` +
      `**Название Цена**\n\n` +
      `**Примеры:**\n` +
      `Пицца 350\n` +
      `Кофе 50\n` +
      `Котлета 85\n\n` +
      `⚠️ **У каждого блюда должна быть указана цена!**\n\n` +
      `👇 **После ввода всех блюд нажмите кнопку ниже** 👇`,
    keyboard,
  );

  return true;
}

/**
 * Парсинг цены из строки
 */
function extractPrice(text) {
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const price = parseInt(match[1]);
  if (isNaN(price) || price <= 0 || price > 1000) return null;
  return price;
}

/**
 * Парсинг названия блюда (всё до цены)
 */
function extractName(text) {
  const match = text.match(/\d+/);
  if (!match) return text.trim();
  const numberIndex = text.indexOf(match[0]);
  let name = text.substring(0, numberIndex).trim();
  if (!name || name.length < 2) return null;
  return name;
}

/**
 * Добавление блюда (поддерживает несколько строк)
 */
async function addMenuItem(userId, text, sendMessage, createKeyboard) {
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);

  if (!session.kitchenMenu || session.kitchenMenu.step !== "items")
    return false;

  const lines = text.split("\n").filter((l) => l.trim() !== "");
  let addedCount = 0;
  let errors = [];

  for (const line of lines) {
    const name = extractName(line);
    const price = extractPrice(line);

    if (!name || !price) {
      errors.push(`❌ "${line}" — неверный формат`);
      continue;
    }

    session.kitchenMenu.items.push({ name, price });
    addedCount++;
  }

  let responseText = "";
  if (addedCount > 0) {
    responseText += `✅ **Добавлено блюд:** ${addedCount}\n`;
    responseText += `📋 **Всего в меню:** ${session.kitchenMenu.items.length}\n\n`;
    responseText += `**Текущий список:**\n`;
    session.kitchenMenu.items.forEach((item, idx) => {
      responseText += `${idx + 1}. **${item.name}** — ${item.price}₽\n`;
    });
  }

  if (errors.length > 0) {
    responseText += `\n${errors.join("\n")}`;
  }

  responseText += `\n👇 **Продолжайте добавлять блюда или нажмите кнопку для завершения** 👇`;

  const keyboard = createKeyboard([
    [{ label: "✅ Завершить и сохранить", cmd: "kitchen_finish" }],
    [{ label: "❌ Отменить", cmd: "kitchen_cancel" }],
  ]);

  await sendMessage(userId, responseText, keyboard);
  return true;
}

/**
 * Сохранение меню в базу данных
 */
async function finishMenuCreation(userId, sendMessage, createKeyboard) {
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);

  if (!session.kitchenMenu || session.kitchenMenu.items.length === 0) {
    await sendMessage(
      userId,
      "❌ Не добавлено ни одного блюда. Создание отменено.",
    );
    session.kitchenMenu = null;
    await showKitchenPanel(userId, sendMessage, createKeyboard);
    return;
  }

  // Получаем пользователя из БД
  const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

  if (!user.city_id || !user.school_id) {
    await sendMessage(
      userId,
      "❌ Ошибка: не указаны город и школа. Обратитесь к администратору.",
    );
    session.kitchenMenu = null;
    return;
  }

  // Проверяем, нет ли уже меню на эту дату
  const existing = prepare(
    "SELECT id FROM menus WHERE school_id = ? AND date = ?",
  ).get(user.school_id, session.kitchenMenu.date);

  if (existing) {
    const keyboard = createKeyboard([
      [{ label: "✅ Да, заменить", cmd: "kitchen_replace" }],
      [{ label: "❌ Нет, отменить", cmd: "kitchen_cancel" }],
    ]);

    session.kitchenMenu.pendingReplace = true;
    await sendMessage(
      userId,
      `⚠️ **Меню на эту дату уже существует**\n\nЗаменить существующее меню?`,
      keyboard,
    );
    return;
  }

  await saveMenuToDB(userId, session.kitchenMenu, sendMessage, createKeyboard);
}

/**
 * Сохранение меню в БД
 */
async function saveMenuToDB(userId, menuData, sendMessage, createKeyboard) {
  const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

  const insert = prepare(`
    INSERT INTO menus (city_id, school_id, date, items, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const itemsJson = JSON.stringify(menuData.items);
  insert.run(user.city_id, user.school_id, menuData.date, itemsJson, user.id);

  let text = `✅ **Меню на ${menuData.displayDate} успешно создано!**\n\n`;
  text += `🏙️ **Город:** ${getCityName(user.city_id)}\n`;
  text += `🏫 **Школа:** ${getSchoolName(user.school_id)}\n\n`;
  text += `**Блюда:**\n`;
  menuData.items.forEach((item, idx) => {
    text += `${idx + 1}. **${item.name}** — ${item.price}₽\n`;
  });

  await sendMessage(userId, text);

  // Очищаем сессию
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);
  session.kitchenMenu = null;

  await showKitchenPanel(userId, sendMessage, createKeyboard);
}

/**
 * Замена существующего меню
 */
async function replaceMenu(userId, sendMessage, createKeyboard) {
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);

  if (!session.kitchenMenu) return;

  const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

  // Удаляем старое меню
  prepare("DELETE FROM menus WHERE school_id = ? AND date = ?").run(
    user.school_id,
    session.kitchenMenu.date,
  );

  // Сохраняем новое
  await saveMenuToDB(userId, session.kitchenMenu, sendMessage, createKeyboard);
}

/**
 * Отмена создания меню
 */
async function cancelMenuCreation(userId, sendMessage, createKeyboard) {
  const { getUserSession } = require("../bot");
  const session = getUserSession(userId);
  session.kitchenMenu = null;
  await showKitchenPanel(userId, sendMessage, createKeyboard);
}

/**
 * Показать список меню
 */
async function showMyMenus(userId, sendMessage, createKeyboard) {
  const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

  const menus = prepare(`
    SELECT id, date, items, created_at
    FROM menus
    WHERE school_id = ?
    ORDER BY date DESC
    LIMIT 10
  `).all(user.school_id);

  if (menus.length === 0) {
    await sendMessage(userId, "📭 У вас пока нет созданных меню.");
    await showKitchenPanel(userId, sendMessage, createKeyboard);
    return;
  }

  let text = "📋 **Ваши меню**\n\n";
  const buttons = [];

  for (const menu of menus) {
    const dateStr = menu.date.split("-").reverse().join(".");
    const items = JSON.parse(menu.items);
    buttons.push([
      {
        label: `${dateStr} (${items.length} блюд)`,
        cmd: `kitchen_view_menu_${menu.id}`,
      },
    ]);
  }

  buttons.push([{ label: "🔙 Назад", cmd: "kitchen_back" }]);
  const keyboard = createKeyboard(buttons);

  await sendMessage(userId, text, keyboard);
}

/**
 * Показать конкретное меню
 */
async function showMenuDetails(userId, menuId, sendMessage, createKeyboard) {
  const menu = prepare(`
    SELECT m.*, c.name as city_name, s.name as school_name
    FROM menus m
    JOIN cities c ON m.city_id = c.id
    JOIN schools s ON m.school_id = s.id
    WHERE m.id = ?
  `).get(menuId);

  if (!menu) {
    await sendMessage(userId, "❌ Меню не найдено");
    return;
  }

  const items = JSON.parse(menu.items);
  const dateStr = menu.date.split("-").reverse().join(".");

  let text = `📅 **Меню на ${dateStr}**\n\n`;
  text += `🏙️ **Город:** ${menu.city_name}\n`;
  text += `🏫 **Школа:** ${menu.school_name}\n\n`;
  text += `**Блюда:**\n`;
  items.forEach((item, idx) => {
    text += `${idx + 1}. **${item.name}** — ${item.price}₽\n`;
  });
  text += `\n📝 Создано: ${new Date(menu.created_at).toLocaleString("ru-RU")}`;

  const keyboard = createKeyboard([
    [{ label: "🔙 Назад к списку", cmd: "kitchen_my_menus" }],
  ]);

  await sendMessage(userId, text, keyboard);
}

module.exports = {
  isKitchen,
  showKitchenPanel,
  startCreateMenu,
  handleMenuDate,
  addMenuItem,
  finishMenuCreation,
  replaceMenu,
  cancelMenuCreation,
  showMyMenus,
  showMenuDetails,
  validateDate,
  extractPrice,
  extractName,
};

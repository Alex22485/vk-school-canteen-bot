// ==================== src/bot.js ====================
// Основной цикл Long Poll и маршрутизация сообщений

const fetch = require("node-fetch");
require("dotenv").config();

const { connectDB } = require("./database/db");
const {
  getUserByVkId,
  isProfileComplete,
  isKitchen,
} = require("./services/userService");
const { getCityName } = require("./services/cityService");
const { getSchoolName } = require("./services/schoolService");
const { createKitchenPanelKeyboard } = require("./utils/keyboard");
const kitchenHandler = require("./handlers/kitchen");
const registerHandler = require("./handlers/register");

// ==================== ПЕРЕМЕННЫЕ ====================
const ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const GROUP_ID = process.env.VK_GROUP_ID;
const API_VERSION = process.env.VK_API_VERSION || "5.199";
const LONG_POLL_WAIT = 25;

let ts = null;
let server = null;
let longPollKey = null;

const userSessions = new Map();

connectDB();
console.log("✅ База данных подключена");

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function getUserSession(userId) {
  if (!userSessions.has(userId)) userSessions.set(userId, {});
  return userSessions.get(userId);
}

function getRoleName(role) {
  const roles = {
    parent: "👪 Родитель/Ученик",
    class_teacher: "🍎 Классный руководитель",
    kitchen: "🍳 Кухня",
    admin: "🔑 Администратор",
    user: "👤 Пользователь",
  };
  return roles[role] || role;
}

// ==================== LONG POLL ФУНКЦИИ ====================

async function getLongPollServer() {
  console.log("🔄 Получение Long Poll сервера...");
  const params = new URLSearchParams();
  params.append("group_id", GROUP_ID);
  params.append("access_token", ACCESS_TOKEN);
  params.append("v", API_VERSION);

  const response = await fetch(
    `https://api.vk.com/method/groups.getLongPollServer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    },
  );
  const data = await response.json();

  if (data.error) throw new Error(data.error.error_msg);

  server = data.response.server;
  ts = data.response.ts;
  longPollKey = data.response.key;
  console.log("✅ Long Poll сервер получен, ts:", ts);
}

async function processEvents(updates) {
  for (const update of updates) {
    if (update.type === "message_new") {
      const msg = update.object.message;
      const userId = msg.from_id;
      const text = msg.text?.trim() || "";
      if (userId > 0) await handleMessage(userId, text);
    }
  }
}

async function sendMessage(userId, text, keyboard = null) {
  const params = new URLSearchParams();
  params.append("user_id", userId);
  params.append("message", text);
  params.append("random_id", Date.now());
  params.append("access_token", ACCESS_TOKEN);
  params.append("v", API_VERSION);
  if (keyboard) params.append("keyboard", JSON.stringify(keyboard));

  try {
    const response = await fetch(`https://api.vk.com/method/messages.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await response.json();
    if (data.error) console.log(`❌ Ошибка отправки: ${data.error.error_msg}`);
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
}

// ==================== ГЛАВНЫЙ ОБРАБОТЧИК ====================

async function handleMessage(userId, text) {
  console.log(`📨 Сообщение от ${userId}: "${text}"`);
  const session = getUserSession(userId);

  // 1. Заполнение профиля
  if (session.profileSetup) {
    await registerHandler.handleProfileStep(userId, text, session, sendMessage);
    return;
  }

  // 2. Ожидание кода
  if (session.waitingFor === "teacher_code") {
    delete session.waitingFor;
    await registerHandler.checkSecretCode(
      userId,
      text,
      process.env.TEACHER_SECRET,
      "class_teacher",
      session,
      sendMessage,
    );
    return;
  }
  if (session.waitingFor === "kitchen_code") {
    delete session.waitingFor;
    await registerHandler.checkSecretCode(
      userId,
      text,
      process.env.KITCHEN_SECRET,
      "kitchen",
      session,
      sendMessage,
    );
    return;
  }

  // 3. Команда /kitchen
  if (text === "/kitchen") {
    const user = getUserByVkId(userId);
    if (!user || user.role !== "kitchen") {
      await sendMessage(userId, "⛔ У вас нет доступа к панели кухни.");
      return;
    }
    await kitchenHandler.showKitchenPanel(
      userId,
      sendMessage,
      createKitchenPanelKeyboard,
    );
    return;
  }

  // 4. Команда /start
  if (text === "/start" || text === "start") {
    await registerHandler.startRoleSelection(userId, sendMessage);
    return;
  }

  // 5. Проверка регистрации
  const user = getUserByVkId(userId);
  if (!user) {
    const handled = await registerHandler.handleRoleChoice(
      userId,
      text,
      session,
      sendMessage,
    );
    if (handled) return;
    await sendMessage(
      userId,
      "❓ Вы не зарегистрированы.\nНапишите /start для начала работы.",
    );
    return;
  }

  // 6. Для кухни — панель кухни
  if (isKitchen(user)) {
    await kitchenHandler.showKitchenPanel(
      userId,
      sendMessage,
      createKitchenPanelKeyboard,
    );
    return;
  }

  // 7. Если профиль не заполнен
  if (!isProfileComplete(user)) {
    session.profileSetup = {
      step: "city",
      role: user.role,
      cityId: null,
      schoolId: null,
      classGrade: null,
      className: null,
      childName: null,
    };
    await registerHandler.askForCity(userId, sendMessage);
    return;
  }

  // 8. Главное меню для пользователей
  let responseText = `👋 С возвращением, ${user.child_name || user.role}!\n\n`;
  responseText += `📋 **Ваши данные:**\n`;
  responseText += `🏙️ Город: ${getCityName(user.city_id)}\n`;
  responseText += `🏫 Школа: ${getSchoolName(user.school_id)}\n`;
  if (user.class_name) responseText += `📚 Класс: ${user.class_name}\n`;
  if (user.child_name) responseText += `👶 Ребёнок: ${user.child_name}\n`;
  responseText += `\n📋 **Доступные команды:**\n`;
  responseText += `/start - Главное меню\n`;
  responseText += `/menu - Посмотреть меню\n`;
  responseText += `/order - Сделать заказ\n`;
  responseText += `/profile - Мой профиль\n`;
  await sendMessage(userId, responseText);
}

// ==================== ЗАПУСК ====================

async function startLongPoll() {
  await getLongPollServer();
  console.log("🔄 Запуск Long Poll цикла...\n");
  while (true) {
    try {
      const url = `${server}?act=a_check&key=${longPollKey}&ts=${ts}&wait=${LONG_POLL_WAIT}&mode=2`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.failed) {
        console.log(`⚠️ Long Poll failed=${data.failed}, переподключение...`);
        await new Promise((r) => setTimeout(r, 2000));
        await getLongPollServer();
        continue;
      }
      ts = data.ts;
      if (data.updates?.length) await processEvents(data.updates);
    } catch (error) {
      console.log(`❌ Ошибка Long Poll: ${error.message}`);
      await new Promise((r) => setTimeout(r, 5000));
      await getLongPollServer();
    }
  }
}

async function launch() {
  console.clear();
  console.log("=".repeat(60));
  console.log("🍽️  БОТ ШКОЛЬНОЙ СТОЛОВОЙ ДЛЯ VK  🍽️");
  console.log("=".repeat(60));
  console.log("");

  const testUrl = `https://api.vk.com/method/groups.getById?group_id=${GROUP_ID}&access_token=${ACCESS_TOKEN}&v=${API_VERSION}`;
  const testResponse = await fetch(testUrl);
  const testData = await testResponse.json();

  if (testData.error) {
    console.error("❌ Ошибка токена:", testData.error.error_msg);
    process.exit(1);
  }

  console.log(`✅ Токен валиден! Группа: ${testData.response.groups[0].name}`);
  console.log(`🆔 ID группы: ${GROUP_ID}\n`);
  await startLongPoll();
}

process.once("SIGINT", () => {
  console.log("\n🛑 Бот остановлен");
  process.exit(0);
});

module.exports = { launch, sendMessage };

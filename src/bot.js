// // ==================== ПОДКЛЮЧЕНИЕ БИБЛИОТЕК ====================
// const fetch = require("node-fetch");
// const logger = require("./utils/logger");
// require("dotenv").config();

// // Подключаем базу данных
// const { connectDB, prepare } = require("./database/db");

// // ==================== ПЕРЕМЕННЫЕ ====================
// const ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
// const GROUP_ID = process.env.VK_GROUP_ID;
// const API_VERSION = process.env.VK_API_VERSION || "5.199";
// const LONG_POLL_WAIT = 25;

// const KITCHEN_SECRET = process.env.KITCHEN_SECRET;
// const TEACHER_SECRET = process.env.TEACHER_SECRET;

// let ts = null;
// let server = null;
// let longPollKey = null;

// const userSessions = new Map();

// connectDB();
// console.log("✅ База данных подключена");

// // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// function getUserSession(userId) {
//   if (!userSessions.has(userId)) {
//     userSessions.set(userId, {});
//   }
//   return userSessions.get(userId);
// }

// function getRoleName(role) {
//   const roles = {
//     parent: "👪 Родитель/Ученик",
//     class_teacher: "🍎 Классный руководитель",
//     kitchen: "🍳 Кухня",
//     admin: "🔑 Администратор",
//     user: "👤 Пользователь",
//   };
//   return roles[role] || role;
// }

// function getCityName(cityId) {
//   if (!cityId) return "Не указан";
//   const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
//   return city ? city.name : "Неизвестный город";
// }

// function getSchoolName(schoolId) {
//   if (!schoolId) return "Не указана";
//   const school = prepare("SELECT name FROM schools WHERE id = ?").get(schoolId);
//   return school ? school.name : "Неизвестная школа";
// }

// function createKeyboard(buttons) {
//   return {
//     one_time: false,
//     buttons: buttons.map((row) =>
//       row.map((btn) => ({
//         action: {
//           type: "text",
//           label: btn.label,
//           payload: JSON.stringify({ cmd: btn.cmd || btn.label }),
//         },
//         color: btn.color || "primary",
//       })),
//     ),
//   };
// }

// // ==================== LONG POLL ФУНКЦИИ ====================

// async function getLongPollServer() {
//   console.log("🔄 Получение Long Poll сервера...");
//   const params = new URLSearchParams();
//   params.append("group_id", GROUP_ID);
//   params.append("access_token", ACCESS_TOKEN);
//   params.append("v", API_VERSION);
//   const response = await fetch(
//     `https://api.vk.com/method/groups.getLongPollServer`,
//     {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: params,
//     },
//   );
//   const data = await response.json();
//   if (data.error) {
//     console.error("❌ Ошибка:", data.error);
//     throw new Error(data.error.error_msg);
//   }
//   server = data.response.server;
//   ts = data.response.ts;
//   longPollKey = data.response.key;
//   console.log("✅ Long Poll сервер получен");
//   console.log(`   ts: ${ts}`);
// }

// async function processEvents(updates) {
//   for (const update of updates) {
//     if (update.type === "message_new") {
//       const message = update.object.message;
//       const userId = message.from_id;
//       const text = message.text?.trim() || "";
//       if (userId > 0) {
//         await handleMessage(userId, text, message);
//       }
//     }
//   }
// }

// async function sendMessage(userId, text, keyboard = null) {
//   const params = new URLSearchParams();
//   params.append("user_id", userId);
//   params.append("message", text);
//   params.append("random_id", Date.now());
//   params.append("access_token", ACCESS_TOKEN);
//   params.append("v", API_VERSION);
//   if (keyboard) {
//     params.append("keyboard", JSON.stringify(keyboard));
//   }
//   try {
//     const response = await fetch(`https://api.vk.com/method/messages.send`, {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: params,
//     });
//     const data = await response.json();
//     if (data.error) {
//       console.log(`❌ Ошибка отправки ${userId}: ${data.error.error_msg}`);
//     }
//   } catch (error) {
//     console.log(`❌ Ошибка: ${error.message}`);
//   }
// }

// // ==================== ФУНКЦИИ ЗАПОЛНЕНИЯ ПРОФИЛЯ ====================

// async function askForCity(userId) {
//   const cities = prepare("SELECT id, name FROM cities ORDER BY name").all();
//   if (cities.length === 0) {
//     await sendMessage(
//       userId,
//       "❌ В системе нет городов. Обратитесь к администратору.",
//     );
//     return;
//   }
//   const buttons = cities.map((city) => [
//     { label: city.name, cmd: `city_${city.id}` },
//   ]);
//   const keyboard = createKeyboard(buttons);
//   await sendMessage(userId, "🏙️ **Выберите город**", keyboard);
// }

// async function askForSchool(userId, cityId) {
//   const schools = prepare(
//     "SELECT id, name FROM schools WHERE city_id = ? ORDER BY name",
//   ).all(cityId);
//   if (schools.length === 0) {
//     await sendMessage(userId, "❌ В выбранном городе нет школ.");
//     return;
//   }
//   const buttons = schools.map((school) => [
//     { label: school.name, cmd: `school_${school.id}` },
//   ]);
//   const keyboard = createKeyboard(buttons);
//   await sendMessage(userId, "🏫 **Выберите школу**", keyboard);
// }

// async function askForClassGrade(userId) {
//   const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
//   const rows = [];
//   for (let i = 0; i < grades.length; i += 4) {
//     rows.push(
//       grades
//         .slice(i, i + 4)
//         .map((g) => ({ label: g.toString(), cmd: `grade_${g}` })),
//     );
//   }
//   const keyboard = createKeyboard(rows);
//   await sendMessage(userId, "🔢 **Выберите цифру класса**", keyboard);
// }

// async function askForClassLetter(userId) {
//   const letters = ["А", "Б", "В", "Г", "Д", "Е"];
//   const rows = [];
//   for (let i = 0; i < letters.length; i += 3) {
//     rows.push(
//       letters.slice(i, i + 3).map((l) => ({ label: l, cmd: `letter_${l}` })),
//     );
//   }
//   const keyboard = createKeyboard(rows);
//   await sendMessage(userId, "🔤 **Выберите букву класса**", keyboard);
// }

// async function askForChildName(userId) {
//   await sendMessage(
//     userId,
//     "👶 **Введите имя и фамилию ребёнка**\n\n" +
//       "Только буквы, пробел и дефис.\n" +
//       "Например: Иван Петров или Анна-Мария Сидорова",
//   );
// }

// async function completeProfile(userId, session) {
//   const profileSetup = session.profileSetup;

//   console.log("📝 completeProfile вызвана");
//   console.log("   cityId:", profileSetup.cityId);
//   console.log("   schoolId:", profileSetup.schoolId);
//   console.log("   className:", profileSetup.className);
//   console.log("   childName:", profileSetup.childName);

//   if (!profileSetup.cityId || !profileSetup.schoolId) {
//     console.log("❌ Ошибка: cityId или schoolId отсутствуют!");
//     await sendMessage(
//       userId,
//       "❌ Ошибка: город или школа не выбраны. Начните заново с /start",
//     );
//     session.profileSetup = null;
//     return;
//   }

//   const update = prepare(`
//     UPDATE users 
//     SET city_id = ?, school_id = ?, class_name = ?, child_name = ?, updated_at = CURRENT_TIMESTAMP
//     WHERE vk_id = ?
//   `);

//   update.run(
//     profileSetup.cityId,
//     profileSetup.schoolId,
//     profileSetup.className || null,
//     profileSetup.childName || null,
//     userId,
//   );

//   session.profileSetup = null;

//   const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

//   let text = `✅ **Профиль успешно заполнен!**\n\n`;
//   text += `👤 **Роль:** ${getRoleName(user.role)}\n`;
//   text += `🏙️ **Город:** ${getCityName(user.city_id)}\n`;
//   text += `🏫 **Школа:** ${getSchoolName(user.school_id)}\n`;
//   if (user.class_name) text += `📚 **Класс:** ${user.class_name}\n`;
//   if (user.child_name) text += `👶 **Ребёнок:** ${user.child_name}\n`;

//   await sendMessage(userId, text);
// }

// // ==================== ОСНОВНАЯ ЛОГИКА РЕГИСТРАЦИИ ====================

// async function cmdStart(userId) {
//   const keyboard = createKeyboard([
//     [{ label: "👪 Родитель/Ученик", cmd: "role_parent" }],
//     [{ label: "🍎 Классный руководитель", cmd: "role_teacher" }],
//     [{ label: "🍳 Кухня", cmd: "role_kitchen" }],
//   ]);
//   await sendMessage(
//     userId,
//     `👋 Добро пожаловать в бот школьной столовой!\n\nВыберите вашу роль:`,
//     keyboard,
//   );
// }

// async function handleRoleChoice(userId, text, session) {
//   let roleType = null;
//   if (text.includes("Родитель") || text.includes("Ученик")) roleType = "parent";
//   else if (text.includes("Классный руководитель") || text.includes("учитель"))
//     roleType = "teacher";
//   else if (text.includes("Кухня")) roleType = "kitchen";
//   if (!roleType) return false;

//   if (roleType === "parent") {
//     const insert = prepare(
//       `INSERT INTO users (vk_id, role, is_active) VALUES (?, ?, 1)`,
//     );
//     insert.run(userId, "parent");
//     session.profileSetup = {
//       step: "city",
//       role: "parent",
//       cityId: null,
//       schoolId: null,
//       classGrade: null,
//       className: null,
//       childName: null,
//     };
//     await askForCity(userId);
//     return true;
//   } else if (roleType === "teacher") {
//     session.waitingFor = "teacher_code";
//     await sendMessage(
//       userId,
//       `🔐 Регистрация для классного руководителя\n\nВведите секретный код:`,
//     );
//     return true;
//   } else if (roleType === "kitchen") {
//     session.waitingFor = "kitchen_code";
//     await sendMessage(
//       userId,
//       `🔐 Регистрация для сотрудника кухни\n\nВведите секретный код:`,
//     );
//     return true;
//   }
//   return false;
// }

// async function checkSecretCode(userId, code, expectedCode, role, session) {
//   if (code === expectedCode) {
//     const insert = prepare(
//       `INSERT INTO users (vk_id, role, is_active) VALUES (?, ?, 1)`,
//     );
//     insert.run(userId, role);
//     session.profileSetup = {
//       step: "city",
//       role: role,
//       cityId: null,
//       schoolId: null,
//       classGrade: null,
//       className: null,
//       childName: null,
//     };
//     await askForCity(userId);
//     return true;
//   } else {
//     await sendMessage(
//       userId,
//       `❌ Неверный код! Напишите /start, чтобы попробовать снова.`,
//     );
//     delete session.waitingFor;
//     return false;
//   }
// }

// async function handleProfileStep(userId, text, session) {
//   const step = session.profileSetup.step;
//   console.log(
//     `🔍 handleProfileStep: step=${step}, text="${text}", cityId=${session.profileSetup.cityId}, schoolId=${session.profileSetup.schoolId}`,
//   );

//   if (step === "city") {
//     let selectedCityId = null;
//     const city = prepare("SELECT id FROM cities WHERE name = ?").get(text);
//     if (city) selectedCityId = city.id;
//     if (selectedCityId) {
//       session.profileSetup.cityId = selectedCityId;
//       session.profileSetup.step = "school";
//       await askForSchool(userId, selectedCityId);
//     } else {
//       await sendMessage(
//         userId,
//         "❌ Город не найден. Пожалуйста, выберите город из кнопок:",
//       );
//       await askForCity(userId);
//     }
//     return;
//   }

//   if (step === "school") {
//     let selectedSchoolId = null;
//     const school = prepare(
//       "SELECT id FROM schools WHERE name = ? AND city_id = ?",
//     ).get(text, session.profileSetup.cityId);
//     if (school) selectedSchoolId = school.id;
//     if (selectedSchoolId) {
//       session.profileSetup.schoolId = selectedSchoolId;
//       const role = session.profileSetup.role;
//       if (role === "parent" || role === "class_teacher") {
//         session.profileSetup.step = "classGrade";
//         await askForClassGrade(userId);
//       } else {
//         await completeProfile(userId, session);
//       }
//     } else {
//       await sendMessage(
//         userId,
//         "❌ Школа не найдена. Пожалуйста, выберите школу из кнопок:",
//       );
//       await askForSchool(userId, session.profileSetup.cityId);
//     }
//     return;
//   }

//   if (step === "classGrade") {
//     const grade = parseInt(text);
//     if (!isNaN(grade) && grade >= 1 && grade <= 11) {
//       session.profileSetup.classGrade = grade;
//       session.profileSetup.step = "classLetter";
//       await askForClassLetter(userId);
//     } else {
//       await sendMessage(
//         userId,
//         "❌ Пожалуйста, выберите цифру класса из кнопок (1-11):",
//       );
//       await askForClassGrade(userId);
//     }
//     return;
//   }

//   if (step === "classLetter") {
//     const letter = text.trim();
//     const validLetters = ["А", "Б", "В", "Г", "Д", "Е"];
//     if (validLetters.includes(letter)) {
//       const fullClassName = `${session.profileSetup.classGrade}${letter}`;
//       session.profileSetup.className = fullClassName;
//       if (session.profileSetup.role === "parent") {
//         session.profileSetup.step = "childName";
//         await askForChildName(userId);
//       } else {
//         await completeProfile(userId, session);
//       }
//     } else {
//       await sendMessage(
//         userId,
//         "❌ Пожалуйста, выберите букву класса из кнопок (А, Б, В, Г, Д, Е):",
//       );
//       await askForClassLetter(userId);
//     }
//     return;
//   }

//   if (step === "childName") {
//     if (!/^[А-Яа-яA-Za-z\s-]+$/.test(text)) {
//       await sendMessage(
//         userId,
//         "❌ Некорректный формат.\n\nИспользуйте только буквы, пробел и дефис.\nНапример: Иван Петров",
//       );
//       return;
//     }
//     session.profileSetup.childName = text;
//     await completeProfile(userId, session);
//     return;
//   }

//   session.profileSetup = null;
//   await sendMessage(
//     userId,
//     "❌ Ошибка заполнения профиля. Начните заново с /start",
//   );
// }

// // ==================== ГЛАВНЫЙ ОБРАБОТЧИК ====================

// async function handleMessage(userId, text, message) {
//   console.log(`📨 Сообщение от ${userId}: "${text}"`);
//   const session = getUserSession(userId);

//   // 1. Обработка заполнения профиля
//   if (session.profileSetup) {
//     await handleProfileStep(userId, text, session);
//     return;
//   }

//   // 2. Обработка ожидания кода учителя
//   if (session.waitingFor === "teacher_code") {
//     delete session.waitingFor;
//     await checkSecretCode(
//       userId,
//       text,
//       TEACHER_SECRET,
//       "class_teacher",
//       session,
//     );
//     return;
//   }

//   // 3. Обработка ожидания кода кухни
//   if (session.waitingFor === "kitchen_code") {
//     delete session.waitingFor;
//     await checkSecretCode(userId, text, KITCHEN_SECRET, "kitchen", session);
//     return;
//   }

//   // 4. КОМАНДА /kitchen (вход в панель кухни)
//   if (text === "/kitchen") {
//     const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);
//     if (!user || user.role !== "kitchen") {
//       await sendMessage(userId, "⛔ У вас нет доступа к панели кухни.");
//       return;
//     }
//     const kitchenHandler = require("./handlers/kitchen");
//     await kitchenHandler.showKitchenPanel(userId, sendMessage, createKeyboard);
//     return;
//   }

//   // 5. Обработка /start
//   if (text === "/start" || text === "start") {
//     await cmdStart(userId);
//     return;
//   }

//   // 6. Проверка регистрации
//   const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

//   if (!user) {
//     // Пользователь не зарегистрирован
//     const handled = await handleRoleChoice(userId, text, session);
//     if (handled) return;
//     await sendMessage(
//       userId,
//       `❓ Вы не зарегистрированы.\nНапишите /start для начала работы.`,
//     );
//     return;
//   }

//   // 7. Если пользователь кухня — показываем панель кухни (даже без /kitchen)
//   if (user.role === "kitchen") {
//     const kitchenHandler = require("./handlers/kitchen");
//     await kitchenHandler.showKitchenPanel(userId, sendMessage, createKeyboard);
//     return;
//   }

//   // 8. Если профиль не заполнен
//   if (!user.city_id || !user.school_id) {
//     session.profileSetup = {
//       step: "city",
//       role: user.role,
//       cityId: null,
//       schoolId: null,
//       classGrade: null,
//       className: null,
//       childName: null,
//     };
//     await askForCity(userId);
//     return;
//   }

//   // 9. Для остальных ролей — обычное меню
//   let responseText = `👋 С возвращением, ${user.child_name || user.role}!\n\n`;
//   responseText += `📋 **Ваши данные:**\n`;
//   responseText += `🏙️ Город: ${getCityName(user.city_id)}\n`;
//   responseText += `🏫 Школа: ${getSchoolName(user.school_id)}\n`;
//   if (user.class_name) responseText += `📚 Класс: ${user.class_name}\n`;
//   if (user.child_name) responseText += `👶 Ребёнок: ${user.child_name}\n`;
//   responseText += `\n📋 **Доступные команды:**\n`;
//   responseText += `/start - Главное меню\n`;
//   responseText += `/menu - Посмотреть меню\n`;
//   responseText += `/order - Сделать заказ\n`;
//   responseText += `/profile - Мой профиль\n\n`;
//   responseText += `Скоро здесь появится полный функционал!`;
//   await sendMessage(userId, responseText);
// }

// // ==================== ЗАПУСК LONG POLL ====================

// async function startLongPoll() {
//   await getLongPollServer();
//   console.log("🔄 Запуск Long Poll цикла...\n");
//   while (true) {
//     try {
//       const longPollUrl = `${server}?act=a_check&key=${longPollKey}&ts=${ts}&wait=${LONG_POLL_WAIT}&mode=2`;
//       const response = await fetch(longPollUrl);
//       const data = await response.json();
//       if (data.failed) {
//         console.log(`⚠️ Long Poll failed=${data.failed}, переподключение...`);
//         await new Promise((resolve) => setTimeout(resolve, 2000));
//         await getLongPollServer();
//         continue;
//       }
//       ts = data.ts;
//       if (data.updates && data.updates.length > 0) {
//         await processEvents(data.updates);
//       }
//     } catch (error) {
//       console.log(`❌ Ошибка Long Poll: ${error.message}`);
//       await new Promise((resolve) => setTimeout(resolve, 5000));
//       await getLongPollServer();
//     }
//   }
// }

// // ==================== ЗАПУСК БОТА ====================

// async function launch() {
//   console.clear();
//   console.log("=".repeat(60));
//   console.log("🍽️  БОТ ШКОЛЬНОЙ СТОЛОВОЙ ДЛЯ VK  🍽️");
//   console.log("=".repeat(60));
//   console.log("");
//   const testUrl = `https://api.vk.com/method/groups.getById?group_id=${GROUP_ID}&access_token=${ACCESS_TOKEN}&v=${API_VERSION}`;
//   const testResponse = await fetch(testUrl);
//   const testData = await testResponse.json();
//   if (testData.error) {
//     console.error("❌ Ошибка токена:", testData.error.error_msg);
//     process.exit(1);
//   }
//   console.log(`✅ Токен валиден! Группа: ${testData.response.groups[0].name}`);
//   console.log(`🆔 ID группы: ${GROUP_ID}`);
//   console.log("");
//   await startLongPoll();
// }

// process.once("SIGINT", () => {
//   console.log("\n🛑 Бот остановлен");
//   process.exit(0);
// });

// module.exports = { launch, sendMessage, createKeyboard };

// ==================== src/bot.js ====================
// Основной цикл Long Poll и маршрутизация сообщений

const fetch = require("node-fetch");
const logger = require("./utils/logger");
require("dotenv").config();

const { connectDB, prepare } = require("./database/db");
const { COMMANDS } = require("./config/constants");
const { getUserByVkId, createUser, isProfileComplete, detectRoleByText, isKitchen } = require("./services/userService");
const { getAllCities, findCityByName } = require("./services/cityService");
const { getSchoolsByCity, findSchoolByNameAndCity } = require("./services/schoolService");
const { getCityName, getSchoolName } = require("./services/cityService");
const { getSchoolName as getSchoolName2 } = require("./services/schoolService");
const { createRoleKeyboard, createCityKeyboard, createSchoolKeyboard, createClassGradeKeyboard, createClassLetterKeyboard, createKitchenPanelKeyboard, createMenuActionKeyboard } = require("./utils/keyboard");
const kitchenHandler = require("./handlers/kitchen");

// ==================== ПЕРЕМЕННЫЕ ====================
const ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const GROUP_ID = process.env.VK_GROUP_ID;
const API_VERSION = process.env.VK_API_VERSION || "5.199";
const LONG_POLL_WAIT = 25;

const KITCHEN_SECRET = process.env.KITCHEN_SECRET;
const TEACHER_SECRET = process.env.TEACHER_SECRET;

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
        user: "👤 Пользователь"
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
    
    const response = await fetch(`https://api.vk.com/method/groups.getLongPollServer`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });
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
            body: params
        });
        const data = await response.json();
        if (data.error) console.log(`❌ Ошибка отправки: ${data.error.error_msg}`);
    } catch (error) {
        console.log(`❌ Ошибка: ${error.message}`);
    }
}

// ==================== ОБРАБОТЧИКИ РЕГИСТРАЦИИ ====================

async function cmdStart(userId) {
    await sendMessage(userId, "👋 Добро пожаловать в бот школьной столовой!\n\nВыберите вашу роль:", createRoleKeyboard());
}

async function handleRegistration(userId, text, session) {
    const role = detectRoleByText(text);
    if (!role) return false;
    
    if (role === 'parent') {
        createUser(userId, 'parent');
        session.profileSetup = { step: 'city', role: 'parent', cityId: null, schoolId: null, classGrade: null, className: null, childName: null };
        await askForCity(userId);
        return true;
    } else if (role === 'teacher') {
        session.waitingFor = 'teacher_code';
        await sendMessage(userId, "🔐 Регистрация для классного руководителя\n\nВведите секретный код:");
        return true;
    } else if (role === 'kitchen') {
        session.waitingFor = 'kitchen_code';
        await sendMessage(userId, "🔐 Регистрация для сотрудника кухни\n\nВведите секретный код:");
        return true;
    }
    return false;
}

async function checkSecretCode(userId, code, expectedCode, role, session) {
    if (code === expectedCode) {
        createUser(userId, role);
        session.profileSetup = { step: 'city', role: role, cityId: null, schoolId: null, classGrade: null, className: null, childName: null };
        await askForCity(userId);
        return true;
    } else {
        await sendMessage(userId, "❌ Неверный код! Напишите /start, чтобы попробовать снова.");
        delete session.waitingFor;
        return false;
    }
}

// ==================== ЗАПОЛНЕНИЕ ПРОФИЛЯ ====================

async function askForCity(userId) {
    const cities = getAllCities();
    if (cities.length === 0) {
        await sendMessage(userId, "❌ В системе нет городов. Обратитесь к администратору.");
        return;
    }
    await sendMessage(userId, "🏙️ **Выберите город**", createCityKeyboard(cities));
}

async function askForSchool(userId, cityId) {
    const schools = getSchoolsByCity(cityId);
    if (schools.length === 0) {
        await sendMessage(userId, "❌ В выбранном городе нет школ.");
        return;
    }
    await sendMessage(userId, "🏫 **Выберите школу**", createSchoolKeyboard(schools));
}

async function askForClassGrade(userId) {
    await sendMessage(userId, "🔢 **Выберите цифру класса**", createClassGradeKeyboard());
}

async function askForClassLetter(userId) {
    await sendMessage(userId, "🔤 **Выберите букву класса**", createClassLetterKeyboard());
}

async function askForChildName(userId) {
    await sendMessage(userId, "👶 **Введите имя и фамилию ребёнка**\n\nТолько буквы, пробел и дефис.\nНапример: Иван Петров");
}

async function completeProfile(userId, session) {
    const ps = session.profileSetup;
    if (!ps.cityId || !ps.schoolId) {
        await sendMessage(userId, "❌ Ошибка: город или школа не выбраны.");
        session.profileSetup = null;
        return;
    }
    
    const update = prepare(`UPDATE users SET city_id = ?, school_id = ?, class_name = ?, child_name = ?, updated_at = CURRENT_TIMESTAMP WHERE vk_id = ?`);
    update.run(ps.cityId, ps.schoolId, ps.className || null, ps.childName || null, userId);
    session.profileSetup = null;
    
    const user = getUserByVkId(userId);
    await sendMessage(userId, `✅ **Профиль успешно заполнен!**\n\n👤 Роль: ${getRoleName(user.role)}\n🏙️ Город: ${getCityName(user.city_id)}\n🏫 Школа: ${getSchoolName2(user.school_id)}`);
}

async function handleProfileStep(userId, text, session) {
    const step = session.profileSetup.step;
    
    if (step === 'city') {
        const city = findCityByName(text);
        if (city) {
            session.profileSetup.cityId = city.id;
            session.profileSetup.step = 'school';
            await askForSchool(userId, city.id);
        } else {
            await sendMessage(userId, "❌ Город не найден. Выберите из списка:");
            await askForCity(userId);
        }
        return;
    }
    
    if (step === 'school') {
        const school = findSchoolByNameAndCity(text, session.profileSetup.cityId);
        if (school) {
            session.profileSetup.schoolId = school.id;
            const role = session.profileSetup.role;
            if (role === 'parent' || role === 'class_teacher') {
                session.profileSetup.step = 'classGrade';
                await askForClassGrade(userId);
            } else {
                await completeProfile(userId, session);
            }
        } else {
            await sendMessage(userId, "❌ Школа не найдена. Выберите из списка:");
            await askForSchool(userId, session.profileSetup.cityId);
        }
        return;
    }
    
    if (step === 'classGrade') {
        const grade = parseInt(text);
        if (!isNaN(grade) && grade >= 1 && grade <= 11) {
            session.profileSetup.classGrade = grade;
            session.profileSetup.step = 'classLetter';
            await askForClassLetter(userId);
        } else {
            await sendMessage(userId, "❌ Выберите цифру из кнопок (1-11):");
            await askForClassGrade(userId);
        }
        return;
    }
    
    if (step === 'classLetter') {
        const validLetters = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
        if (validLetters.includes(text)) {
            session.profileSetup.className = `${session.profileSetup.classGrade}${text}`;
            if (session.profileSetup.role === 'parent') {
                session.profileSetup.step = 'childName';
                await askForChildName(userId);
            } else {
                await completeProfile(userId, session);
            }
        } else {
            await sendMessage(userId, "❌ Выберите букву из кнопок (А, Б, В, Г, Д, Е):");
            await askForClassLetter(userId);
        }
        return;
    }
    
    if (step === 'childName') {
        if (!/^[А-Яа-яA-Za-z\s-]+$/.test(text)) {
            await sendMessage(userId, "❌ Некорректный формат. Используйте только буквы, пробел и дефис.");
            return;
        }
        session.profileSetup.childName = text;
        await completeProfile(userId, session);
        return;
    }
    
    session.profileSetup = null;
    await sendMessage(userId, "❌ Ошибка заполнения профиля. Начните заново с /start");
}

// ==================== ГЛАВНЫЙ ОБРАБОТЧИК ====================

async function handleMessage(userId, text) {
    console.log(`📨 Сообщение от ${userId}: "${text}"`);
    const session = getUserSession(userId);
    
    // 1. Заполнение профиля
    if (session.profileSetup) {
        await handleProfileStep(userId, text, session);
        return;
    }
    
    // 2. Ожидание кода
    if (session.waitingFor === 'teacher_code') {
        delete session.waitingFor;
        await checkSecretCode(userId, text, TEACHER_SECRET, 'class_teacher', session);
        return;
    }
    if (session.waitingFor === 'kitchen_code') {
        delete session.waitingFor;
        await checkSecretCode(userId, text, KITCHEN_SECRET, 'kitchen', session);
        return;
    }
    
    // 3. Команда /kitchen
    if (text === '/kitchen') {
        const user = getUserByVkId(userId);
        if (!user || user.role !== 'kitchen') {
            await sendMessage(userId, "⛔ У вас нет доступа к панели кухни.");
            return;
        }
        await kitchenHandler.showKitchenPanel(userId, sendMessage, createKitchenPanelKeyboard);
        return;
    }
    
    // 4. Команда /start
    if (text === '/start' || text === 'start') {
        await cmdStart(userId);
        return;
    }
    
    // 5. Проверка регистрации
    const user = getUserByVkId(userId);
    if (!user) {
        const handled = await handleRegistration(userId, text, session);
        if (handled) return;
        await sendMessage(userId, "❓ Вы не зарегистрированы.\nНапишите /start для начала работы.");
        return;
    }
    
    // 6. Для кухни — панель кухни
    if (isKitchen(user)) {
        await kitchenHandler.showKitchenPanel(userId, sendMessage, createKitchenPanelKeyboard);
        return;
    }
    
    // 7. Если профиль не заполнен
    if (!isProfileComplete(user)) {
        session.profileSetup = { step: 'city', role: user.role, cityId: null, schoolId: null, classGrade: null, className: null, childName: null };
        await askForCity(userId);
        return;
    }
    
    // 8. Главное меню для пользователей
    let responseText = `👋 С возвращением, ${user.child_name || user.role}!\n\n`;
    responseText += `📋 **Ваши данные:**\n`;
    responseText += `🏙️ Город: ${getCityName(user.city_id)}\n`;
    responseText += `🏫 Школа: ${getSchoolName2(user.school_id)}\n`;
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
                await new Promise(r => setTimeout(r, 2000));
                await getLongPollServer();
                continue;
            }
            ts = data.ts;
            if (data.updates?.length) await processEvents(data.updates);
        } catch (error) {
            console.log(`❌ Ошибка Long Poll: ${error.message}`);
            await new Promise(r => setTimeout(r, 5000));
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
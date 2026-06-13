// ==================== src/handlers/profile.js ====================
// Обработчик заполнения профиля пользователя

const { prepare } = require("../database/db");

/**
 * Запрос выбора города
 */
async function askForCity(userId, sendMessage, createKeyboard) {
  const cities = prepare("SELECT id, name FROM cities ORDER BY name").all();

  if (cities.length === 0) {
    await sendMessage(
      userId,
      "❌ В системе нет городов. Обратитесь к администратору.",
    );
    return;
  }

  // Создаём кнопки с городами
  const buttons = cities.map((city) => [
    { label: city.name, cmd: `city_${city.id}` },
  ]);

  const keyboard = createKeyboard(buttons);

  await sendMessage(userId, "🏙️ **Выберите ваш город**", keyboard);
}

/**
 * Запрос выбора школы
 */
async function askForSchool(userId, cityId, sendMessage, createKeyboard) {
  const schools = prepare(
    "SELECT id, name FROM schools WHERE city_id = ? ORDER BY name",
  ).all(cityId);

  if (schools.length === 0) {
    await sendMessage(userId, "❌ В выбранном городе нет школ.");
    return;
  }

  const buttons = schools.map((school) => [
    { label: school.name, cmd: `school_${school.id}` },
  ]);

  const keyboard = createKeyboard(buttons);

  await sendMessage(userId, "🏫 **Выберите вашу школу**", keyboard);
}

/**
 * Запрос класса (для родителей и учителей)
 */
async function askForClass(userId, role, sendMessage, createKeyboard) {
  const keyboard = createKeyboard([
    [{ label: "1А" }, { label: "1Б" }, { label: "1В" }, { label: "1Г" }],
    [{ label: "2А" }, { label: "2Б" }, { label: "2В" }, { label: "2Г" }],
    [{ label: "3А" }, { label: "3Б" }, { label: "3В" }, { label: "3Г" }],
    [{ label: "4А" }, { label: "4Б" }, { label: "4В" }, { label: "4Г" }],
    [{ label: "5А" }, { label: "5Б" }, { label: "5В" }, { label: "5Г" }],
    [{ label: "6А" }, { label: "6Б" }, { label: "6В" }, { label: "6Г" }],
    [{ label: "7А" }, { label: "7Б" }, { label: "7В" }, { label: "7Г" }],
    [{ label: "8А" }, { label: "8Б" }, { label: "8В" }, { label: "8Г" }],
    [{ label: "9А" }, { label: "9Б" }, { label: "9В" }, { label: "9Г" }],
    [{ label: "10А" }, { label: "10Б" }, { label: "11А" }, { label: "11Б" }],
  ]);

  const text =
    role === "parent"
      ? "📚 **Выберите класс ребёнка**"
      : "📚 **Выберите ваш класс**";

  await sendMessage(userId, text, keyboard);
}

/**
 * Запрос имени ребёнка (только для родителей)
 */
async function askForChildName(userId, sendMessage) {
  await sendMessage(
    userId,
    "👶 **Введите имя и фамилию ребёнка**\n\n" +
      "Только буквы, пробел и дефис.\n" +
      "Например: Иван Петров или Анна-Мария Сидорова",
  );
}

/**
 * Завершение профиля — сохранение в БД
 */
async function completeProfile(userId, profileData, sendMessage) {
  const update = prepare(`
        UPDATE users 
        SET city_id = ?, school_id = ?, class_name = ?, child_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE vk_id = ?
    `);

  update.run(
    profileData.cityId,
    profileData.schoolId,
    profileData.className || null,
    profileData.childName || null,
    userId,
  );

  // Получаем обновлённые данные пользователя
  const user = prepare("SELECT * FROM users WHERE vk_id = ?").get(userId);

  // Показываем финальное сообщение
  let text = `✅ **Профиль успешно заполнен!**\n\n`;
  text += `👤 **Роль:** ${getRoleName(user.role)}\n`;
  text += `🏙️ **Город:** ${getCityName(user.city_id)}\n`;
  text += `🏫 **Школа:** ${getSchoolName(user.school_id)}\n`;
  if (user.class_name) text += `📚 **Класс:** ${user.class_name}\n`;
  if (user.child_name) text += `👶 **Ребёнок:** ${user.child_name}\n`;

  await sendMessage(userId, text);
}

// Вспомогательные функции
function getCityName(cityId) {
  const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
  return city ? city.name : "Неизвестный город";
}

function getSchoolName(schoolId) {
  const school = prepare("SELECT name FROM schools WHERE id = ?").get(schoolId);
  return school ? school.name : "Неизвестная школа";
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

// Экспортируем функции
module.exports = {
  askForCity,
  askForSchool,
  askForClass,
  askForChildName,
  completeProfile,
  getCityName,
  getSchoolName,
};

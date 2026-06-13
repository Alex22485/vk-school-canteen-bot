// ==================== src/handlers/register.js ====================
// Регистрация пользователя, выбор роли, заполнение профиля

const { prepare } = require("../database/db");
const { createUser, getUserByVkId, updateUserProfile, detectRoleByText, getRoleDisplay } = require("../services/userService");
const { getAllCities, findCityByName, getCityName } = require("../services/cityService");
const { getSchoolsByCity, findSchoolByNameAndCity, getSchoolName } = require("../services/schoolService");
const {
    createRoleKeyboard,
    createCityKeyboard,
    createSchoolKeyboard,
    createClassGradeKeyboard,
    createClassLetterKeyboard
} = require("../utils/keyboard");

const KITCHEN_SECRET = process.env.KITCHEN_SECRET;
const TEACHER_SECRET = process.env.TEACHER_SECRET;

/**
 * Начать регистрацию — показать выбор роли
 */
async function startRoleSelection(userId, sendMessage) {
    await sendMessage(userId, "👋 Добро пожаловать в бот школьной столовой!\n\nВыберите вашу роль:", createRoleKeyboard());
}

/**
 * Обработка выбора роли
 */
async function handleRoleChoice(userId, text, session, sendMessage) {
    const role = detectRoleByText(text);
    if (!role) return false;
    
    if (role === 'parent') {
        createUser(userId, 'parent');
        session.profileSetup = {
            step: 'city',
            role: 'parent',
            cityId: null,
            schoolId: null,
            classGrade: null,
            className: null,
            childName: null
        };
        await askForCity(userId, sendMessage);
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

/**
 * Проверка секретного кода
 */
async function checkSecretCode(userId, code, expectedCode, role, session, sendMessage) {
    if (code === expectedCode) {
        createUser(userId, role);
        session.profileSetup = {
            step: 'city',
            role: role,
            cityId: null,
            schoolId: null,
            classGrade: null,
            className: null,
            childName: null
        };
        await askForCity(userId, sendMessage);
        return true;
    } else {
        await sendMessage(userId, "❌ Неверный код! Напишите /start, чтобы попробовать снова.");
        delete session.waitingFor;
        return false;
    }
}

// ==================== ЗАПОЛНЕНИЕ ПРОФИЛЯ ====================

async function askForCity(userId, sendMessage) {
    const cities = getAllCities();
    if (cities.length === 0) {
        await sendMessage(userId, "❌ В системе нет городов. Обратитесь к администратору.");
        return;
    }
    await sendMessage(userId, "🏙️ **Выберите город**", createCityKeyboard(cities));
}

async function askForSchool(userId, cityId, sendMessage) {
    const schools = getSchoolsByCity(cityId);
    if (schools.length === 0) {
        await sendMessage(userId, "❌ В выбранном городе нет школ.");
        return;
    }
    await sendMessage(userId, "🏫 **Выберите школу**", createSchoolKeyboard(schools));
}

async function askForClassGrade(userId, sendMessage) {
    await sendMessage(userId, "🔢 **Выберите цифру класса**", createClassGradeKeyboard());
}

async function askForClassLetter(userId, sendMessage) {
    await sendMessage(userId, "🔤 **Выберите букву класса**", createClassLetterKeyboard());
}

async function askForChildName(userId, sendMessage) {
    await sendMessage(userId, "👶 **Введите имя и фамилию ребёнка**\n\nТолько буквы, пробел и дефис.\nНапример: Иван Петров");
}

async function completeProfile(userId, session, sendMessage) {
    const ps = session.profileSetup;
    if (!ps.cityId || !ps.schoolId) {
        await sendMessage(userId, "❌ Ошибка: город или школа не выбраны.");
        session.profileSetup = null;
        return;
    }
    
    updateUserProfile(userId, ps.cityId, ps.schoolId, ps.className, ps.childName);
    session.profileSetup = null;
    
    const user = getUserByVkId(userId);
    await sendMessage(userId, `✅ **Профиль успешно заполнен!**\n\n👤 Роль: ${getRoleDisplay(user.role)}\n🏙️ Город: ${getCityName(user.city_id)}\n🏫 Школа: ${getSchoolName(user.school_id)}`);
}

async function handleProfileStep(userId, text, session, sendMessage) {
    const step = session.profileSetup.step;
    
    if (step === 'city') {
        const city = findCityByName(text);
        if (city) {
            session.profileSetup.cityId = city.id;
            session.profileSetup.step = 'school';
            await askForSchool(userId, city.id, sendMessage);
        } else {
            await sendMessage(userId, "❌ Город не найден. Выберите из списка:");
            await askForCity(userId, sendMessage);
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
                await askForClassGrade(userId, sendMessage);
            } else {
                await completeProfile(userId, session, sendMessage);
            }
        } else {
            await sendMessage(userId, "❌ Школа не найдена. Выберите из списка:");
            await askForSchool(userId, session.profileSetup.cityId, sendMessage);
        }
        return;
    }
    
    if (step === 'classGrade') {
        const grade = parseInt(text);
        if (!isNaN(grade) && grade >= 1 && grade <= 11) {
            session.profileSetup.classGrade = grade;
            session.profileSetup.step = 'classLetter';
            await askForClassLetter(userId, sendMessage);
        } else {
            await sendMessage(userId, "❌ Выберите цифру из кнопок (1-11):");
            await askForClassGrade(userId, sendMessage);
        }
        return;
    }
    
    if (step === 'classLetter') {
        const validLetters = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
        if (validLetters.includes(text)) {
            session.profileSetup.className = `${session.profileSetup.classGrade}${text}`;
            if (session.profileSetup.role === 'parent') {
                session.profileSetup.step = 'childName';
                await askForChildName(userId, sendMessage);
            } else {
                await completeProfile(userId, session, sendMessage);
            }
        } else {
            await sendMessage(userId, "❌ Выберите букву из кнопок (А, Б, В, Г, Д, Е):");
            await askForClassLetter(userId, sendMessage);
        }
        return;
    }
    
    if (step === 'childName') {
        if (!/^[А-Яа-яA-Za-z\s-]+$/.test(text)) {
            await sendMessage(userId, "❌ Некорректный формат. Используйте только буквы, пробел и дефис.");
            return;
        }
        session.profileSetup.childName = text;
        await completeProfile(userId, session, sendMessage);
        return;
    }
    
    session.profileSetup = null;
    await sendMessage(userId, "❌ Ошибка заполнения профиля. Начните заново с /start");
}

module.exports = {
    startRoleSelection,
    handleRoleChoice,
    checkSecretCode,
    handleProfileStep,
    askForCity
};

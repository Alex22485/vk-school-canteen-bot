// ==================== src/utils/keyboard.js ====================
// Централизованное создание клавиатур для VK бота

const { CLASS_GRADES, VALID_CLASS_LETTERS } = require('../config/constants');

/**
 * Базовый метод создания клавиатуры для VK API
 * @param {Array} buttons - массив кнопок [[{label, cmd, color}, ...]]
 * @returns {Object} - объект клавиатуры для VK API
 */
function createKeyboard(buttons) {
    return {
        one_time: false,
        buttons: buttons.map((row) =>
            row.map((btn) => ({
                action: {
                    type: "text",
                    label: btn.label,
                    payload: JSON.stringify({ cmd: btn.cmd || btn.label })
                },
                color: btn.color || "primary"
            }))
        )
    };
}

// ==================== КЛАВИАТУРЫ ДЛЯ РЕГИСТРАЦИИ ====================

/**
 * Клавиатура выбора роли
 */
function createRoleKeyboard() {
    return createKeyboard([
        [{ label: "👪 Родитель/Ученик", cmd: "role_parent" }],
        [{ label: "🍎 Классный руководитель", cmd: "role_teacher" }],
        [{ label: "🍳 Кухня", cmd: "role_kitchen" }]
    ]);
}

/**
 * Клавиатура выбора города
 * @param {Array} cities - массив городов [{id, name}]
 */
function createCityKeyboard(cities) {
    const buttons = cities.map(city => [{ label: city.name, cmd: `city_${city.id}` }]);
    return createKeyboard(buttons);
}

/**
 * Клавиатура выбора школы
 * @param {Array} schools - массив школ [{id, name}]
 */
function createSchoolKeyboard(schools) {
    const buttons = schools.map(school => [{ label: school.name, cmd: `school_${school.id}` }]);
    return createKeyboard(buttons);
}

/**
 * Клавиатура выбора цифры класса (1-11)
 */
function createClassGradeKeyboard() {
    const rows = [];
    for (let i = 0; i < CLASS_GRADES.length; i += 4) {
        rows.push(
            CLASS_GRADES.slice(i, i + 4).map(g => ({ 
                label: g.toString(), 
                cmd: `grade_${g}` 
            }))
        );
    }
    return createKeyboard(rows);
}

/**
 * Клавиатура выбора буквы класса (А, Б, В, Г, Д, Е)
 */
function createClassLetterKeyboard() {
    const rows = [];
    for (let i = 0; i < VALID_CLASS_LETTERS.length; i += 3) {
        rows.push(
            VALID_CLASS_LETTERS.slice(i, i + 3).map(l => ({ 
                label: l, 
                cmd: `letter_${l}` 
            }))
        );
    }
    return createKeyboard(rows);
}

// ==================== КЛАВИАТУРЫ ДЛЯ КУХНИ ====================

/**
 * Клавиатура главной панели кухни
 */
function createKitchenPanelKeyboard() {
    return createKeyboard([
        [{ label: "📅 Создать меню", cmd: "kitchen_create_menu" }],
        [{ label: "📋 Мои меню", cmd: "kitchen_my_menus" }],
        [{ label: "🔙 Главное меню", cmd: "main_menu" }]
    ]);
}

/**
 * Клавиатура действий с меню (завершить/отменить)
 */
function createMenuActionKeyboard() {
    return createKeyboard([
        [{ label: "✅ Завершить и сохранить", cmd: "kitchen_finish" }],
        [{ label: "❌ Отменить", cmd: "kitchen_cancel" }]
    ]);
}

/**
 * Клавиатура подтверждения замены меню
 */
function createReplaceMenuKeyboard() {
    return createKeyboard([
        [{ label: "✅ Да, заменить", cmd: "kitchen_replace" }],
        [{ label: "❌ Нет, отменить", cmd: "kitchen_cancel" }]
    ]);
}

/**
 * Клавиатура списка меню
 * @param {Array} menus - массив меню [{id, date, items}]
 */
function createMenusListKeyboard(menus) {
    const buttons = [];
    for (const menu of menus) {
        const dateStr = menu.date.split('-').reverse().join('.');
        const items = JSON.parse(menu.items);
        buttons.push([{ 
            label: `${dateStr} (${items.length} блюд)`, 
            cmd: `kitchen_view_menu_${menu.id}` 
        }]);
    }
    buttons.push([{ label: "🔙 Назад", cmd: "kitchen_back" }]);
    return createKeyboard(buttons);
}

// ==================== КЛАВИАТУРЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ====================

/**
 * Клавиатура главного меню пользователя
 */
function createUserMainKeyboard() {
    return createKeyboard([
        [{ label: "🍽️ Посмотреть меню", cmd: "user_menu" }],
        [{ label: "📝 Мои заказы", cmd: "user_orders" }],
        [{ label: "👤 Профиль", cmd: "user_profile" }]
    ]);
}

/**
 * Клавиатура списка доступных меню для пользователя
 * @param {Array} menus - массив меню [{id, date, items}]
 */
function createUserMenusListKeyboard(menus) {
    const buttons = [];
    for (const menu of menus) {
        const dateStr = menu.date.split('-').reverse().join('.');
        const items = JSON.parse(menu.items);
        buttons.push([{ 
            label: `${dateStr} (${items.length} блюд)`, 
            cmd: `user_view_menu_${menu.id}` 
        }]);
    }
    buttons.push([{ label: "🔙 Назад", cmd: "user_menu_back" }]);
    return createKeyboard(buttons);
}

module.exports = {
    createKeyboard,
    createRoleKeyboard,
    createCityKeyboard,
    createSchoolKeyboard,
    createClassGradeKeyboard,
    createClassLetterKeyboard,
    createKitchenPanelKeyboard,
    createMenuActionKeyboard,
    createReplaceMenuKeyboard,
    createMenusListKeyboard,
    createUserMainKeyboard,
    createUserMenusListKeyboard
};

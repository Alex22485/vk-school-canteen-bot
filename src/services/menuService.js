// ==================== src/services/menuService.js ====================
// Сервис для работы с меню

const { prepare } = require('../database/db');

function getMenusBySchool(schoolId, limit = 10) {
    return prepare(`
        SELECT id, date, items, created_at
        FROM menus
        WHERE school_id = ?
        ORDER BY date DESC
        LIMIT ?
    `).all(schoolId, limit);
}

function getMenuById(menuId) {
    return prepare(`
        SELECT m.*, c.name as city_name, s.name as school_name
        FROM menus m
        JOIN cities c ON m.city_id = c.id
        JOIN schools s ON m.school_id = s.id
        WHERE m.id = ?
    `).get(menuId);
}

function getMenuByDate(schoolId, date) {
    return prepare("SELECT id FROM menus WHERE school_id = ? AND date = ?").get(schoolId, date);
}

function createMenu(cityId, schoolId, date, items, createdBy) {
    const itemsJson = JSON.stringify(items);
    const insert = prepare(`
        INSERT INTO menus (city_id, school_id, date, items, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    return insert.run(cityId, schoolId, date, itemsJson, createdBy);
}

function deleteMenu(schoolId, date) {
    return prepare("DELETE FROM menus WHERE school_id = ? AND date = ?").run(schoolId, date);
}

function validateMenuDate(dateStr) {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
        return { valid: false, error: "❌ Неверный формат. Используйте ДД.ММ.ГГГГ" };
    }
    
    const [day, month, year] = dateStr.split('.').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (selectedDate < tomorrow) {
        return { valid: false, error: "❌ Меню можно создавать только на завтра и более поздние дни" };
    }
    
    return {
        valid: true,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        displayDate: dateStr
    };
}

function extractPrice(text) {
    const match = text.match(/(\d+)/);
    if (!match) return null;
    const price = parseInt(match[1]);
    if (isNaN(price) || price <= 0 || price > 1000) return null;
    return price;
}

function extractName(text) {
    const match = text.match(/\d+/);
    if (!match) return text.trim();
    const numberIndex = text.indexOf(match[0]);
    let name = text.substring(0, numberIndex).trim();
    if (!name || name.length < 2) return null;
    return name;
}

function parseMenuItem(line) {
    const name = extractName(line);
    const price = extractPrice(line);
    
    if (!name || !price) {
        return { valid: false, error: 'Неверный формат. Нужно: "Название Цена"' };
    }
    
    return { valid: true, item: { name, price } };
}

module.exports = {
    getMenusBySchool,
    getMenuById,
    getMenuByDate,
    createMenu,
    deleteMenu,
    validateMenuDate,
    extractPrice,
    extractName,
    parseMenuItem
};

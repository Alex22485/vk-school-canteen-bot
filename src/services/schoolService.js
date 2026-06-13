// ==================== src/services/schoolService.js ====================
// Сервис для работы со школами

const { prepare } = require('../database/db');

function getSchoolsByCity(cityId) {
    if (!cityId) return [];
    return prepare("SELECT id, name FROM schools WHERE city_id = ? ORDER BY name").all(cityId);
}

function findSchoolByNameAndCity(name, cityId) {
    return prepare("SELECT id FROM schools WHERE name = ? AND city_id = ?").get(name, cityId);
}

function getSchoolName(schoolId) {
    if (!schoolId) return "Не указана";
    const school = prepare("SELECT name FROM schools WHERE id = ?").get(schoolId);
    return school ? school.name : "Неизвестная школа";
}

function schoolExists(schoolId) {
    const school = prepare("SELECT id FROM schools WHERE id = ?").get(schoolId);
    return !!school;
}

module.exports = {
    getSchoolsByCity,
    findSchoolByNameAndCity,
    getSchoolName,
    schoolExists
};

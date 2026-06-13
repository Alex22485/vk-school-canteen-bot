// ==================== src/services/cityService.js ====================
// Сервис для работы с городами

const { prepare } = require('../database/db');

function getAllCities() {
    return prepare("SELECT id, name FROM cities ORDER BY name").all();
}

function findCityByName(name) {
    return prepare("SELECT id FROM cities WHERE name = ?").get(name);
}

function getCityName(cityId) {
    if (!cityId) return "Не указан";
    const city = prepare("SELECT name FROM cities WHERE id = ?").get(cityId);
    return city ? city.name : "Неизвестный город";
}

function cityExists(cityId) {
    const city = prepare("SELECT id FROM cities WHERE id = ?").get(cityId);
    return !!city;
}

module.exports = {
    getAllCities,
    findCityByName,
    getCityName,
    cityExists
};

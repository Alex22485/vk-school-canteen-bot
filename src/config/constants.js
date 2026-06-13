// ==================== src/config/constants.js ====================

// Роли пользователей
const ROLES = {
    PARENT: 'parent',
    TEACHER: 'class_teacher',
    KITCHEN: 'kitchen',
    ADMIN: 'admin',
    USER: 'user'
};

// Названия ролей для отображения
const ROLE_NAMES = {
    [ROLES.PARENT]: '👪 Родитель/Ученик',
    [ROLES.TEACHER]: '🍎 Классный руководитель',
    [ROLES.KITCHEN]: '🍳 Кухня',
    [ROLES.ADMIN]: '🔑 Администратор',
    [ROLES.USER]: '👤 Пользователь'
};

// Допустимые буквы класса
const VALID_CLASS_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

// Допустимые цифры класса
const CLASS_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Префиксы команд
const COMMANDS = {
    START: '/start',
    KITCHEN: '/kitchen',
    MENU: '/menu',
    ORDER: '/order',
    PROFILE: '/profile'
};

// Секретные коды (будут из .env)
const SECRETS = {
    KITCHEN: process.env.KITCHEN_SECRET,
    TEACHER: process.env.TEACHER_SECRET
};

module.exports = {
    ROLES,
    ROLE_NAMES,
    VALID_CLASS_LETTERS,
    CLASS_GRADES,
    COMMANDS,
    SECRETS
};

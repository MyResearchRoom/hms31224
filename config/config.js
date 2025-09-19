require("dotenv").config();

module.exports = {
  development: {
    username: "u575240270_hmshost",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST,
    dialect: "mysql",
    logging: false,
  },
  test: {
    username: "u575240270_hmshost",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST,
    dialect: "mysql",
  },
  production: {
    username: "u575240270_hmshost",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST,
    dialect: "mysql",
  },
  max_receptionist: process.env.MAX_RECEPTIONIST,
};

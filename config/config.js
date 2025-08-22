require("dotenv").config();

module.exports = {
  development: {
    username: "root",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST,
    dialect: "mysql",
    logging: false,
  },
  test: {
    username: "root",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST,
    dialect: "mysql",
  },
  production: {
    username: "root",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST,
    dialect: "mysql",
  },
};

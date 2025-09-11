"use strict";

const {
  getDecryptedDocumentAsBase64,
  encrypt,
} = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const ReceptionistDocument = sequelize.define("ReceptionistDocument", {
    document: {
      type: DataTypes.BLOB("long"),
      allowNull: false,
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },


  },
    {
      tableName: "receptionist_documents",
    }
  );

  const ENCRYPT_FIELDS = ["document"];

  // Encrypt hook
  ReceptionistDocument.addHook("beforeCreate", (document) =>
    encryptFields(document)
  );
  ReceptionistDocument.addHook("beforeUpdate", (document) =>
    encryptFields(document)
  );

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  ReceptionistDocument.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        values[field] = getDecryptedDocumentAsBase64(values[field]);
      }
    });

    delete values.password;
    return values;
  };

  ReceptionistDocument.associate = (models) => {
    // Each ReceptionistDocument belongs to a doctor
    ReceptionistDocument.belongsTo(models.Receptionist, {
      foreignKey: "receptionistId",
      as: "receptionist",
    });
  };

  return ReceptionistDocument;
};

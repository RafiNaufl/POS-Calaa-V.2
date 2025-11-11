const fs = require('fs');
const path = require('path');

/**
 * Prisma to Sequelize Model Converter
 * Script untuk membantu konversi model Prisma ke Sequelize
 */

class PrismaToSequelizeConverter {
  constructor() {
    this.typeMapping = {
      'String': 'DataTypes.STRING',
      'Int': 'DataTypes.INTEGER',
      'Float': 'DataTypes.FLOAT',
      'Boolean': 'DataTypes.BOOLEAN',
      'DateTime': 'DataTypes.DATE',
      'Json': 'DataTypes.JSON',
      'Bytes': 'DataTypes.BLOB',
    };

    this.attributeMapping = {
      '@id': 'primaryKey: true',
      '@unique': 'unique: true',
      '@default(now())': 'defaultValue: DataTypes.NOW',
      '@default(cuid())': 'defaultValue: () => require("cuid")()',
      '@updatedAt': '// handled by timestamps: true',
    };
  }

  /**
   * Parse Prisma schema file
   */
  parsePrismaSchema(schemaPath) {
    const content = fs.readFileSync(schemaPath, 'utf8');
    const models = this.extractModels(content);
    return models;
  }

  /**
   * Extract models from Prisma schema content
   */
  extractModels(content) {
    const models = [];
    const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
    let match;

    while ((match = modelRegex.exec(content)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      const fields = this.parseFields(modelBody);
      
      models.push({
        name: modelName,
        fields: fields,
      });
    }

    return models;
  }

  /**
   * Parse fields from model body
   */
  parseFields(modelBody) {
    const fields = [];
    const lines = modelBody.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
      if (line.startsWith('//') || line.startsWith('@@')) continue;
      
      const fieldMatch = line.match(/(\w+)\s+(\w+(\[\])?(\?)?)\s*(.*)/);
      if (fieldMatch) {
        const [, name, type, , optional, attributes] = fieldMatch;
        
        fields.push({
          name,
          type: type.replace('?', '').replace('[]', ''),
          optional: !!optional,
          isArray: type.includes('[]'),
          attributes: attributes || '',
        });
      }
    }

    return fields;
  }

  /**
   * Convert Prisma model to Sequelize model
   */
  convertModel(model) {
    const { name, fields } = model;
    
    let sequelizeModel = `const { DataTypes } = require('sequelize');\n`;
    sequelizeModel += `const { v4: uuidv4 } = require('uuid');\n\n`;
    sequelizeModel += `module.exports = (sequelize) => {\n`;
    sequelizeModel += `  const ${name} = sequelize.define('${name}', {\n`;

    // Convert fields
    const sequelizeFields = [];
    const relations = [];
    const indexes = [];

    for (const field of fields) {
      if (this.isRelationField(field, fields)) {
        relations.push(field);
        continue;
      }

      const sequelizeField = this.convertField(field);
      if (sequelizeField) {
        sequelizeFields.push(sequelizeField);
      }

      // Check for indexes
      if (field.attributes.includes('@unique')) {
        indexes.push(`      { fields: ['${field.name}'], unique: true }`);
      }
    }

    sequelizeModel += sequelizeFields.join(',\n');
    sequelizeModel += '\n  }, {\n';
    sequelizeModel += '    timestamps: true,\n';
    sequelizeModel += `    tableName: '${name}',\n`;

    // Add indexes if any
    if (indexes.length > 0) {
      sequelizeModel += '    indexes: [\n';
      sequelizeModel += indexes.join(',\n') + '\n';
      sequelizeModel += '    ],\n';
    }

    sequelizeModel += '  });\n\n';

    // Add associations
    if (relations.length > 0) {
      sequelizeModel += `  ${name}.associate = (models) => {\n`;
      for (const relation of relations) {
        const association = this.generateAssociation(relation, name);
        if (association) {
          sequelizeModel += `    ${association}\n`;
        }
      }
      sequelizeModel += '  };\n\n';
    }

    sequelizeModel += `  return ${name};\n`;
    sequelizeModel += '};';

    return sequelizeModel;
  }

  /**
   * Convert Prisma field to Sequelize field
   */
  convertField(field) {
    const { name, type, optional, attributes } = field;
    
    // Skip relation fields and special fields
    if (name === 'createdAt' || name === 'updatedAt') {
      return null; // Handled by timestamps
    }

    let sequelizeType = this.typeMapping[type] || 'DataTypes.STRING';
    let fieldDef = `    ${name}: {\n`;
    fieldDef += `      type: ${sequelizeType},\n`;

    // Handle primary key
    if (attributes.includes('@id')) {
      fieldDef += '      primaryKey: true,\n';
      
      if (attributes.includes('@default(cuid())')) {
        fieldDef += '      defaultValue: () => require("cuid")(),\n';
      } else if (attributes.includes('@default(uuid())')) {
        fieldDef += '      defaultValue: () => uuidv4().replace(/-/g, ""),\n';
      }
    }

    // Handle nullable
    if (!optional && !attributes.includes('@id')) {
      fieldDef += '      allowNull: false,\n';
    }

    // Handle unique
    if (attributes.includes('@unique')) {
      fieldDef += '      unique: true,\n';
    }

    // Handle default values
    if (attributes.includes('@default(') && !attributes.includes('@default(cuid())') && !attributes.includes('@default(uuid())')) {
      const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
      if (defaultMatch) {
        let defaultValue = defaultMatch[1];
        if (defaultValue === 'now()') {
          fieldDef += '      defaultValue: DataTypes.NOW,\n';
        } else if (defaultValue === 'true' || defaultValue === 'false') {
          fieldDef += `      defaultValue: ${defaultValue},\n`;
        } else if (!isNaN(defaultValue)) {
          fieldDef += `      defaultValue: ${defaultValue},\n`;
        } else {
          fieldDef += `      defaultValue: '${defaultValue}',\n`;
        }
      }
    }

    // Handle foreign keys
    if (name.endsWith('Id') && type === 'String') {
      const referencedModel = name.replace('Id', '');
      const capitalizedModel = referencedModel.charAt(0).toUpperCase() + referencedModel.slice(1);
      fieldDef += '      references: {\n';
      fieldDef += `        model: '${capitalizedModel}',\n`;
      fieldDef += '        key: \'id\',\n';
      fieldDef += '      },\n';
    }

    // Add basic validations
    if (type === 'String' && !optional) {
      fieldDef += '      validate: {\n';
      fieldDef += '        notEmpty: true,\n';
      fieldDef += '      },\n';
    }

    if (type === 'Float' || type === 'Int') {
      fieldDef += '      validate: {\n';
      fieldDef += '        min: 0,\n';
      fieldDef += '      },\n';
    }

    fieldDef += '    }';
    return fieldDef;
  }

  /**
   * Check if field is a relation field
   */
  isRelationField(field, allFields) {
    // Check if it's a relation by looking for corresponding foreign key
    const possibleForeignKey = `${field.name}Id`;
    return allFields.some(f => f.name === possibleForeignKey) || 
           field.type.charAt(0) === field.type.charAt(0).toUpperCase();
  }

  /**
   * Generate Sequelize association
   */
  generateAssociation(relation, modelName) {
    const { name, type } = relation;
    
    if (name.endsWith('s') && type.charAt(0) === type.charAt(0).toUpperCase()) {
      // hasMany relation
      return `${modelName}.hasMany(models.${type}, { foreignKey: '${modelName.toLowerCase()}Id', as: '${name}' });`;
    } else if (type.charAt(0) === type.charAt(0).toUpperCase()) {
      // belongsTo relation
      return `${modelName}.belongsTo(models.${type}, { foreignKey: '${name}Id', as: '${name}' });`;
    }
    
    return null;
  }

  /**
   * Generate all Sequelize models from Prisma schema
   */
  convertSchema(schemaPath, outputDir) {
    const models = this.parsePrismaSchema(schemaPath);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Convert each model
    for (const model of models) {
      const sequelizeModel = this.convertModel(model);
      const fileName = `${model.name.toLowerCase()}.js`;
      const filePath = path.join(outputDir, fileName);
      
      fs.writeFileSync(filePath, sequelizeModel);
      console.log(`✅ Generated: ${fileName}`);
    }

    // Generate index.js
    this.generateIndexFile(models, outputDir);
    
    console.log(`\n🎉 Conversion completed! Generated ${models.length} models in ${outputDir}`);
    console.log('\n📝 Next steps:');
    console.log('1. Review generated models and adjust as needed');
    console.log('2. Add proper validations and hooks');
    console.log('3. Configure database connection');
    console.log('4. Test the models');
  }

  /**
   * Generate index.js file for models
   */
  generateIndexFile(models, outputDir) {
    let indexContent = `const { Sequelize } = require('sequelize');\n`;
    indexContent += `const config = require('../config/database');\n\n`;
    indexContent += `const env = process.env.NODE_ENV || 'development';\n`;
    indexContent += `const dbConfig = config[env];\n\n`;
    indexContent += `let sequelize;\n`;
    indexContent += `if (dbConfig.use_env_variable) {\n`;
    indexContent += `  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);\n`;
    indexContent += `} else {\n`;
    indexContent += `  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);\n`;
    indexContent += `}\n\n`;
    indexContent += `const db = {};\n\n`;

    // Import models
    for (const model of models) {
      indexContent += `db.${model.name} = require('./${model.name.toLowerCase()}')(sequelize);\n`;
    }

    indexContent += `\n// Setup associations\n`;
    indexContent += `Object.keys(db).forEach(modelName => {\n`;
    indexContent += `  if (db[modelName].associate) {\n`;
    indexContent += `    db[modelName].associate(db);\n`;
    indexContent += `  }\n`;
    indexContent += `});\n\n`;
    indexContent += `db.sequelize = sequelize;\n`;
    indexContent += `db.Sequelize = Sequelize;\n\n`;
    indexContent += `module.exports = db;`;

    const indexPath = path.join(outputDir, 'index.js');
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ Generated: index.js');
  }
}

// CLI Usage
if (require.main === module) {
  const converter = new PrismaToSequelizeConverter();
  
  const schemaPath = process.argv[2] || './prisma/schema.prisma';
  const outputDir = process.argv[3] || './sequelize-models';

  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Prisma schema file not found: ${schemaPath}`);
    process.exit(1);
  }

  console.log('🚀 Starting Prisma to Sequelize conversion...');
  console.log(`📁 Schema: ${schemaPath}`);
  console.log(`📁 Output: ${outputDir}\n`);

  converter.convertSchema(schemaPath, outputDir);
}

module.exports = PrismaToSequelizeConverter;
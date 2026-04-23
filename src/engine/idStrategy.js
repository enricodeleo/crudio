import { randomUUID } from 'node:crypto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IdStrategy {
  constructor(idSchema) {
    if (!idSchema) {
      this.type = 'integer';
    } else if (idSchema.type === 'integer') {
      this.type = 'integer';
    } else if (idSchema.type === 'string' && idSchema.format === 'uuid') {
      this.type = 'uuid';
    } else if (idSchema.type === 'string') {
      this.type = 'string';
    } else {
      this.type = 'integer';
    }
  }

  generate(existingItems) {
    switch (this.type) {
      case 'integer': {
        if (existingItems.length === 0) return 1;
        const maxId = Math.max(...existingItems.map((item) => Number(item.id)));
        return maxId + 1;
      }
      case 'uuid':
        return randomUUID();
      case 'string':
        return randomUUID().slice(0, 8);
    }
  }

  validate(id) {
    switch (this.type) {
      case 'integer':
        return !isNaN(Number(id));
      case 'uuid':
        return UUID_REGEX.test(String(id));
      case 'string':
        return typeof id === 'string';
    }
  }
}

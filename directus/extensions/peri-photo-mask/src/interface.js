import { defineInterface } from '@directus/extensions-sdk';
import component from './interface.vue';
export default defineInterface({
  id: 'peri-photo-mask', name: 'Фото с плашкой PERI', icon: 'visibility_off',
  description: 'Загрузка фотографии и сохранение копии с плашками на глазах.',
  component, types: ['uuid'], localTypes: ['file'], group: 'relational', options: null,
});

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { maskGroup } from './geometry.js';
const props = defineProps({ value: { default: null }, disabled: Boolean, collection: String, field: String, primaryKey: [String, Number] });
const emit = defineEmits(['input']);
const api = useApi();
const uploadInput = ref(null), uploading = ref(false), uploadError = ref('');
const modal = ref(null), stage = ref(null), loading = ref(false), saving = ref(false), error = ref(''), notice = ref('');
const imageReady = ref(false);
const imageUrl = ref(''), width = ref(1000), height = ref(1000), masks = ref([]), selected = ref(0);
const active = computed(() => masks.value[selected.value]);
const fileId = computed(() => typeof props.value === 'object' ? props.value?.id : props.value);
let editingId, drag, abort;
async function upload(event) {
  const file = event.target.files?.[0];
  if (!file || props.disabled || uploading.value) return;
  uploading.value = true; uploadError.value = ''; notice.value = '';
  try {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/files', form);
    emit('input', data.data.id);
    notice.value = 'Фото загружено. Сохраните запись, чтобы применить его на сайте.';
  } catch (e) {
    uploadError.value = e.response?.data?.errors?.[0]?.message || 'Не удалось загрузить фото. Попробуйте ещё раз.';
  } finally {
    uploading.value = false;
    event.target.value = '';
  }
}
function clearImage() { if (imageUrl.value) URL.revokeObjectURL(imageUrl.value); imageUrl.value = ''; }
function close() {
  if (saving.value) return;
  abort?.abort(); modal.value?.close(); clearImage(); error.value = ''; drag = null;
}
onBeforeUnmount(() => { abort?.abort(); clearImage(); });
function add() {
  if (masks.value.length >= 12) return;
  masks.value.push({ x: 0.5, y: 0.35, width: 0.4, height: 0.08, angle: 0 });
  selected.value = masks.value.length - 1;
}
async function open() {
  editingId = fileId.value; imageReady.value = false; error.value = ''; notice.value = ''; loading.value = true;
  masks.value = []; clearImage(); modal.value.showModal();
  abort = new AbortController();
  try {
    const { data } = await api.get(`/peri-photo-mask/${editingId}`, { signal: abort.signal });
    const image = await api.get(`/assets/${data.data.source}`, { responseType: 'blob', signal: abort.signal });
    imageUrl.value = URL.createObjectURL(image.data);
    masks.value = data.data.masks.map(m => ({ ...m }));
    selected.value = 0;
    if (!masks.value.length) add();
    await nextTick();
  } catch (e) { if (e.code !== 'ERR_CANCELED') error.value = e.response?.data?.errors?.[0]?.message || 'Не удалось открыть фото. Попробуйте ещё раз.'; }
  finally { loading.value = false; }
}
function imageLoaded(e) { imageReady.value = true; width.value = e.target.naturalWidth; height.value = e.target.naturalHeight; }
function down(event, index) {
  if (saving.value || event.button > 0) return;
  selected.value = index;
  const rect = stage.value.getBoundingClientRect();
  drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, mx: active.value.x, my: active.value.y, width: rect.width, height: rect.height };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
}
const clamp = n => Math.max(0, Math.min(1, n));
function move(event) {
  if (!drag || drag.pointer !== event.pointerId) return;
  active.value.x = clamp(drag.mx + (event.clientX - drag.x) / drag.width);
  active.value.y = clamp(drag.my + (event.clientY - drag.y) / drag.height);
}
function key(event, index) {
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!directions[event.key] || saving.value) return;
  event.preventDefault(); selected.value = index;
  const [dx, dy] = directions[event.key], step = event.shiftKey ? 0.02 : 0.002;
  active.value.x = clamp(active.value.x + dx * step); active.value.y = clamp(active.value.y + dy * step);
}
async function save() {
  saving.value = true; error.value = '';
  try {
    const { data } = await api.post(`/peri-photo-mask/${editingId}`, { masks: masks.value });
    emit('input', data.data.id);
    notice.value = 'Копия с плашкой готова. Сохраните запись, чтобы применить её на сайте.';
    saving.value = false; close();
  } catch (e) { error.value = e.response?.data?.errors?.[0]?.message || 'Не удалось сохранить копию. Ваши настройки сохранены в этом окне.'; }
  finally { saving.value = false; }
}
</script>

<template>
  <div class="peri-mask-field">
    <interface-file-image :value="value" :disabled="disabled || uploading" :collection="collection" :field="field" :primary-key="primaryKey" @input="emit('input', $event); notice = ''; uploadError = ''" />
    <template v-if="!disabled">
      <input ref="uploadInput" class="peri-mask-upload-input" type="file" accept="image/*" aria-label="Загрузить фотографию с устройства" :disabled="uploading" @change="upload" />
      <v-button secondary small class="peri-mask-open" :disabled="uploading" @click="uploadInput?.click()">{{ uploading ? 'Загружаем фото…' : fileId ? 'Заменить фото с устройства' : 'Загрузить фото с устройства' }}</v-button>
    </template>
    <v-button v-if="fileId && !disabled" :disabled="uploading" secondary small class="peri-mask-open" @click="open">Закрыть глаза / изменить плашки</v-button>
    <p v-if="uploadError" role="alert" class="peri-mask-error">{{ uploadError }}</p>
    <p v-if="notice" role="status" class="peri-mask-notice">{{ notice }}</p>
    <Teleport to="body">
      <dialog ref="modal" class="peri-mask-dialog" aria-label="Плашки на фотографии" @cancel.prevent="close">
        <header><div><h2>Плашки на фотографии</h2><p>Передвиньте плашку на глаза. Размер и наклон можно настроить ниже.</p></div><button type="button" :disabled="saving" aria-label="Закрыть редактор" @click="close">✕</button></header>
        <p v-if="loading" role="status">Загружаем оригинал…</p>
        <p v-if="error" role="alert" class="peri-mask-error">{{ error }}</p>
        <div v-if="imageUrl" class="peri-mask-workspace">
          <div class="peri-mask-photo">
            <div ref="stage" class="peri-mask-stage">
              <img :src="imageUrl" alt="Фотография для размещения плашек" @load="imageLoaded" @error="imageReady = false; error = 'Не удалось прочитать изображение. Загрузите фото в JPEG, PNG или WebP.'" />
              <svg :viewBox="`0 0 ${width} ${height}`" class="peri-mask-overlay" aria-label="Положение плашек">
                <g v-for="(mask, index) in masks" :key="index" tabindex="0" role="button" :aria-label="`Плашка ${index + 1}. Переместите пальцем или стрелками клавиатуры.`" @pointerdown="down($event, index)" @pointermove="move" @pointerup="drag = null" @pointercancel="drag = null" @lostpointercapture="drag = null" @keydown="key($event, index)" @focus="selected = index">
                  <g v-html="maskGroup(mask, width, height)" />
                  <rect v-if="selected === index" :x="-mask.width * width / 2" :y="-mask.height * height / 2" :width="mask.width * width" :height="mask.height * height" :transform="`translate(${mask.x * width} ${mask.y * height}) rotate(${mask.angle})`" fill="transparent" stroke="#ffffff" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="5 4" />
                </g>
              </svg>
            </div>
          </div>
          <fieldset :disabled="saving" class="peri-mask-controls">
            <legend>Настройки плашки</legend>
            <label>Плашка<select v-model.number="selected"><option v-for="(_, i) in masks" :key="i" :value="i">Плашка {{ i + 1 }}</option></select></label>
            <template v-if="active">
              <label>Ширина <span class="peri-mask-value" aria-hidden="true">{{ Math.round(active.width * 100) }}%</span><input v-model.number="active.width" type="range" min="0.02" max="1" step="0.005" /></label>
              <label>Высота <span class="peri-mask-value" aria-hidden="true">{{ Math.round(active.height * 100) }}%</span><input v-model.number="active.height" type="range" min="0.01" max="1" step="0.005" /></label>
              <label>Наклон <span class="peri-mask-value" aria-hidden="true">{{ active.angle }}°</span><input v-model.number="active.angle" type="range" min="-180" max="180" step="1" /></label>
            </template>
            <button type="button" :disabled="masks.length >= 12" @click="add">Добавить плашку</button>
            <button type="button" :disabled="masks.length <= 1" @click="masks.splice(selected, 1); selected = 0">Удалить выбранную</button>
            <p>Плашка сохраняется прямо в изображении. Оригинал остаётся в библиотеке сотрудников.</p>
          </fieldset>
        </div>
        <footer><button type="button" :disabled="saving" @click="close">Отмена</button><button type="button" class="peri-mask-save" :disabled="loading || saving || !imageReady || !masks.length" @click="save">{{ saving ? 'Создаём копию…' : 'Сохранить копию' }}</button></footer>
      </dialog>
    </Teleport>
  </div>
</template>

<style>
.peri-mask-open { margin-top: 12px; }
.peri-mask-upload-input { display: none; }
.peri-mask-notice { margin-top: 10px; color: var(--theme--foreground); }
.peri-mask-dialog { color: var(--theme--foreground, #24231f); background: var(--theme--background, #fff); border: 1px solid var(--theme--border-color, #ddd); border-radius: 12px; padding: 24px; width: min(1120px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; margin: auto; font-family: inherit; }
.peri-mask-dialog::backdrop { background: rgb(0 0 0 / .65); }
.peri-mask-dialog header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.peri-mask-dialog h2 { font-size: 22px; font-weight: 650; margin: 0 0 8px; }
.peri-mask-dialog p { line-height: 1.5; }
.peri-mask-dialog button, .peri-mask-dialog select { font: inherit; color: inherit; border: 1px solid var(--theme--border-color, #ccc); border-radius: 6px; background: var(--theme--background, #fff); padding: 10px 14px; min-height: 44px; cursor: pointer; }
.peri-mask-dialog button:disabled { opacity: .5; cursor: default; }
.peri-mask-dialog :focus-visible { outline: 3px solid #aa892f; outline-offset: 3px; }
.peri-mask-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 24px; }
.peri-mask-photo { display: flex; align-items: center; justify-content: center; background: #e9e9e9; border-radius: 6px; padding: 12px; min-width: 0; }
.peri-mask-stage { position: relative; line-height: 0; max-width: 100%; }
.peri-mask-stage img { display: block; max-width: 100%; max-height: 60dvh; width: auto; height: auto; }
.peri-mask-overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
.peri-mask-overlay g[role=button] { cursor: grab; touch-action: none; }
.peri-mask-overlay g[role=button]:active { cursor: grabbing; }
.peri-mask-controls { display: flex; flex-direction: column; gap: 16px; padding: 0; border: 0; min-width: 0; }
.peri-mask-controls legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.peri-mask-controls label { display: block; font-weight: 550; }
.peri-mask-controls .peri-mask-value { float: right; font-weight: normal; }
.peri-mask-controls input, .peri-mask-controls select { display: block; width: 100%; margin-top: 8px; }
.peri-mask-controls input { accent-color: #aa892f; min-height: 28px; }
.peri-mask-controls p { font-size: 13px; }
.peri-mask-dialog footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.peri-mask-dialog .peri-mask-save { background: #aa892f; border-color: #aa892f; color: #fff; font-weight: 650; }
.peri-mask-error { color: var(--theme--danger, #b3261e); padding: 12px 0; }
@media (max-width: 700px) { .peri-mask-dialog { padding: 16px; width: calc(100vw - 16px); max-height: calc(100dvh - 16px); } .peri-mask-workspace { grid-template-columns: 1fr; gap: 16px; } .peri-mask-stage img { max-height: 45dvh; } .peri-mask-controls { gap: 12px; } .peri-mask-dialog footer { position: sticky; bottom: -16px; padding: 12px 0; background: var(--theme--background, #fff); } }
</style>

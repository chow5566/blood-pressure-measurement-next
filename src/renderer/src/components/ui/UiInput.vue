<template>
  <div class="ui-input-wrap" :class="{ 'is-invalid': invalid }">
    <UiIcon v-if="icon" :name="icon" :size="15" class="ui-input-wrap__icon" />
    <input
      class="ui-input"
      :class="{
        'ui-input--lg': size === 'lg',
        'ui-input--with-icon': !!icon,
        'ui-input--invalid': invalid
      }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import type { IconName } from './icons'

/** 基础输入框（自建，无 Element 依赖）；支持可选的内嵌前置图标与错误态 */
withDefaults(
  defineProps<{
    modelValue?: string
    type?: string
    placeholder?: string
    size?: 'md' | 'lg'
    disabled?: boolean
    /** 内嵌前置图标（如 user / lock / shield） */
    icon?: IconName
    /** 错误态：红色边框 */
    invalid?: boolean
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '',
    size: 'md',
    disabled: false,
    icon: undefined,
    invalid: false
  }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<style scoped>
.ui-input-wrap {
  position: relative;
  width: 100%;
}
.ui-input-wrap__icon {
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  color: var(--t3);
  pointer-events: none;
  transition: color 0.15s ease;
}
.ui-input-wrap:focus-within .ui-input-wrap__icon {
  color: var(--accent);
}
.ui-input-wrap.is-invalid .ui-input-wrap__icon {
  color: var(--danger);
}

.ui-input {
  width: 100%;
  height: var(--ctrl-h);
  padding: 0 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--t1);
  font-family: inherit;
  font-size: var(--fs-base);
  outline: none;
}
.ui-input::placeholder {
  color: var(--t3);
}
.ui-input:hover {
  border-color: var(--t2);
}
.ui-input:focus {
  border-color: var(--primary);
}
.ui-input--lg {
  height: 40px;
}
.ui-input--with-icon {
  padding-left: 32px;
}
.ui-input--invalid,
.ui-input--invalid:focus {
  border-color: var(--danger);
}
.ui-input:disabled {
  background: var(--surface-3);
  color: var(--disabled);
  cursor: not-allowed;
}
</style>

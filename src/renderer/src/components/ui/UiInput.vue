<template>
  <input
    class="ui-input"
    :class="{ 'ui-input--lg': size === 'lg' }"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
  />
</template>

<script setup lang="ts">
/** 基础输入框（自建，无 Element 依赖） */
withDefaults(
  defineProps<{
    modelValue?: string
    type?: string
    placeholder?: string
    size?: 'md' | 'lg'
    disabled?: boolean
  }>(),
  { modelValue: '', type: 'text', placeholder: '', size: 'md', disabled: false }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<style scoped>
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
.ui-input:disabled {
  background: var(--surface-3);
  color: var(--disabled);
  cursor: not-allowed;
}
</style>

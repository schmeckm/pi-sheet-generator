<template>
  <div>
    <p
      v-for="(p, i) in block.paragraphs"
      :key="`p-${i}`"
      class="mb-3 text-sm leading-relaxed text-[var(--sapTextColor)]"
    >
      {{ p }}
    </p>

    <HelpZoomableMedia
      v-if="block.diagram"
      type="diagram"
      :content="block.diagram"
      :initial-scale="1.25"
    />

    <HelpZoomableMedia
      v-if="block.image"
      type="image"
      :src="block.image"
      :alt="block.imageAlt || ''"
      :caption="block.imageCaption || ''"
      :initial-scale="1"
    />

    <ol v-if="block.steps" class="list-decimal space-y-2 pl-5 text-sm">
      <li v-for="(step, i) in block.steps" :key="`s-${i}`">{{ step }}</li>
    </ol>

    <ul v-if="block.list" class="space-y-3 text-sm">
      <li v-for="(item, i) in block.list" :key="`l-${i}`">
        <strong class="text-[var(--sapBrandColor)]">{{ item.label }}</strong>
        <span class="text-[var(--sapTextColor)]"> — {{ item.text }}</span>
      </li>
    </ul>

    <ul v-if="block.paths" class="mt-3 space-y-1 font-mono text-xs text-slate-600">
      <li v-for="(path, i) in block.paths" :key="`path-${i}`">{{ path }}</li>
    </ul>

    <p
      v-if="block.tableCaption"
      class="mb-2 text-xs text-[var(--sapContentLabelColor)]"
    >
      {{ block.tableCaption }}
    </p>

    <div v-if="block.table" class="mt-3 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="sr-only">
          <tr>
            <th scope="col">{{ block.tableCol1 || 'Column 1' }}</th>
            <th scope="col">{{ block.tableCol2 || 'Column 2' }}</th>
            <th v-if="block.table?.[0]?.length > 2" scope="col">
              {{ block.tableCol3 || 'Column 3' }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="(row, i) in block.table" :key="`t-${i}`">
            <td
              class="py-2 pr-4 text-[var(--sapTextColor)]"
              :class="row.length <= 2 ? 'font-mono text-xs text-[var(--sapBrandColor)]' : 'font-medium'"
            >
              {{ row[0] }}
            </td>
            <td class="py-2 pr-4 text-[var(--sapTextColor)]">{{ row[1] }}</td>
            <td v-if="row[2]" class="py-2 text-[var(--sapTextColor)]">{{ row[2] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import HelpZoomableMedia from '@/components/help/HelpZoomableMedia.vue';

defineProps({
  block: {
    type: Object,
    required: true,
  },
});
</script>

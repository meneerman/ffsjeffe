import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Leest een voorbeeldbestand uit data-template/recepten (tests draaien vanuit app/). */
export const leesVoorbeeld = (f: string) => readFileSync(join(process.cwd(), '..', 'data-template', 'recepten', f), 'utf8')

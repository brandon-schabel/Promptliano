export async function runBun(cwd: string, args: string[]) {
  const proc = Bun.spawn(['bun', ...args], { cwd, stdio: ['inherit', 'inherit', 'inherit'] })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`bun ${args.join(' ')} failed with code ${code}`)
  }
}

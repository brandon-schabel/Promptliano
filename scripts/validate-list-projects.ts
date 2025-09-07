import { listProjects } from '@promptliano/services'

async function main() {
  const projects = await listProjects()
  if (!projects || projects.length === 0) {
    console.log('No projects found')
  } else {
    console.log(`Found ${projects.length} project(s). First:`, projects[0])
  }
}

main().catch((err) => {
  console.error('Failed to list projects:', err)
  process.exit(1)
})

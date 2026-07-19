export interface DbPackage {
  name: string
  path: string
  deployOnBuild: boolean
  schemas: string[]
}

export const dbPackages: DbPackage[] = [
  { name: 'fnb-auth', path: 'db/fnb-auth', deployOnBuild: true,  schemas: ['auth'] },
  { name: 'fnb-app',  path: 'db/fnb-app',  deployOnBuild: true,  schemas: ['app', 'app_fn', 'app_api'] },
  { name: 'fnb-msg',  path: 'db/fnb-msg',  deployOnBuild: true, schemas: ['msg'] },
  { name: 'fnb-loc',  path: 'db/fnb-loc',  deployOnBuild: true,  schemas: ['loc', 'loc_fn', 'loc_api'] },
  { name: 'fnb-todo', path: 'db/fnb-todo', deployOnBuild: true, schemas: ['todo', 'todo_fn', 'todo_api'] },
  { name: 'fnb-wf',   path: 'db/fnb-wf',   deployOnBuild: true,  schemas: ['wf', 'wf_fn', 'wf_api'] },
  { name: 'fnb-storage', path: 'db/fnb-storage', deployOnBuild: true, schemas: ['storage'] },
]

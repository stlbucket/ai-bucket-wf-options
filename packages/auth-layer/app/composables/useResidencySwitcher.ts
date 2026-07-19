import {
  useResidencySwitcher as _useResidencySwitcher,
  type UseResidencySwitcherReturn,
} from '@function-bucket/fnb-auth-ui'

export type { ResidencySwitchNode } from '@function-bucket/fnb-auth-ui'

export function useResidencySwitcher(): UseResidencySwitcherReturn {
  return _useResidencySwitcher()
}

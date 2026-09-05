/**
 * External medicine catalogue lookup abstraction.
 * Phase 6 default: local / unavailable — no network dependency.
 */

export interface MedicineLookupResult {
	gtin: string
	name: string | null
	strengthText: string | null
	formHint: string | null
	packageSize: number | null
	source: string
}

export interface MedicineLookupProvider {
	lookupByGtin (gtin: string): Promise<MedicineLookupResult | null>
}

/**
 * Default provider — never calls the network.
 * Future remote catalogues can implement MedicineLookupProvider.
 */
export const localUnavailableMedicineLookup: MedicineLookupProvider = {
	async lookupByGtin () {
		return null
	},
}

export const medicineLookupProvider: MedicineLookupProvider =
	localUnavailableMedicineLookup

import { convertToParamMap } from '@angular/router';
import { emptyFilters, filtersFromParams, filtersToParams } from './player-filters.model';

describe('Player query parameters', () => {
  it('restores all supported filters, retaining multiple teams and roles', () => {
    const filters = {
      ...emptyFilters(),
      search: 'martínez',
      macroRole: 'A' as const,
      roles: ['Pc', 'A'],
      teams: ['Inter', 'Roma'],
      minFvm: 50,
      maxFvm: 400,
      minQuotation: 5,
      maxQuotation: 50,
      sort: 'fvm-desc' as const,
    };
    expect(filtersFromParams(convertToParamMap(filtersToParams(filters)))).toEqual(filters);
  });

  it('discards invalid roles, sort and numeric values while accepting zero', () => {
    const filters = filtersFromParams(
      convertToParamMap({
        role: 'X',
        sort: 'invalid',
        minFvm: 'NaN',
        maxFvm: '-5',
        minQuotation: 'Infinity',
        maxQuotation: '0',
      }),
    );
    expect(filters).toEqual({ ...emptyFilters(), maxQuotation: 0 });
  });

  it('normalizes repeated and comma-separated parameters', () => {
    const filters = filtersFromParams(
      convertToParamMap({
        team: [' Inter, Roma ', 'Inter'],
        roles: 'Pc, A,Pc,',
        q: '  lautaro  ',
      }),
    );
    expect(filters.teams).toEqual(['Inter', 'Roma']);
    expect(filters.roles).toEqual(['Pc', 'A']);
    expect(filters.search).toBe('lautaro');
  });

  it('explicitly clears parameters when resetting', () => {
    expect(
      Object.values(filtersToParams(emptyFilters())).every((value) => value === null),
    ).toBeTrue();
  });
});

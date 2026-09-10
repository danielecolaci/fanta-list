export type PlayerAuctionStatus = 'available' | 'called' | 'purchased';

export const AUCTION_STATUS_OPTIONS: ReadonlyArray<{
  value: PlayerAuctionStatus;
  label: string;
}> = [
  { value: 'available', label: 'Disponibile' },
  { value: 'called', label: 'Chiamato' },
  { value: 'purchased', label: 'Acquistato' },
];

export const AUCTION_STATUS_ORDER: Record<PlayerAuctionStatus, number> = {
  available: 0,
  called: 1,
  purchased: 2,
};

import { fetchSponsors, fetchSponsorFlashByTrust } from './sponsorsService';
import { fetchGalleryFolders } from './galleryService';
import { fetchEventsByTrust } from './eventsService';
import { fetchNoticeboardByTrust } from './noticeboardService';
import { fetchFacilitiesByTrust } from './facilitiesService';
import { fetchMarqueeUpdatesByTrust } from './marqueeService';
import { fetchTrustees } from './trusteesService';
import { fetchRegisteredMembersByTrust, fetchAllMembersDirectory } from './membersService';

let warmedTrustId = null;

export async function warmupTrustData(trustId) {
  if (!trustId) return;
  if (warmedTrustId === trustId) return;
  warmedTrustId = trustId;

  await Promise.allSettled([
    fetchSponsors(),
    fetchSponsorFlashByTrust(trustId),
    fetchGalleryFolders(trustId),
    fetchEventsByTrust(trustId),
    fetchNoticeboardByTrust(trustId),
    fetchFacilitiesByTrust(trustId),
    fetchMarqueeUpdatesByTrust(trustId),
    fetchTrustees(trustId),
    fetchRegisteredMembersByTrust(trustId),
    fetchAllMembersDirectory(trustId),
  ]);
}

export function resetWarmupMarker() {
  warmedTrustId = null;
}


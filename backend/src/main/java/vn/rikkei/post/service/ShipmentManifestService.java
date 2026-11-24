package vn.rikkei.post.service;

import vn.rikkei.post.dto.tms.CreateManifestRequest;
import vn.rikkei.post.dto.tms.LoadBagToManifestRequest;
import vn.rikkei.post.dto.tms.ManifestResponse;

import java.util.List;

public interface ShipmentManifestService {
    List<ManifestResponse> getAllManifests();
    List<ManifestResponse> getManifestsByHub(Long hubId);
    ManifestResponse getManifestById(Long id);
    ManifestResponse getManifestByCode(String manifestCode);
    ManifestResponse createManifest(CreateManifestRequest request);
    ManifestResponse loadBagToManifest(Long manifestId, LoadBagToManifestRequest request);
    ManifestResponse removeBagFromManifest(Long manifestId, String bagCode);
    ManifestResponse dispatchManifest(Long manifestId);
    ManifestResponse arriveManifest(Long manifestId);
    ManifestResponse completeManifest(Long manifestId);
}

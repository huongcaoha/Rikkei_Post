package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.network.NetworkTopologyResponse;
import vn.rikkei.post.service.NetworkTopologyService;

@RestController
@RequestMapping("/api/v1/network")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
public class NetworkTopologyController {

    private final NetworkTopologyService networkTopologyService;

    @GetMapping("/topology")
    public ResponseEntity<ApiResponse<NetworkTopologyResponse>> getNetworkTopology() {
        NetworkTopologyResponse topology = networkTopologyService.getNetworkTopology();
        return ResponseEntity.ok(ApiResponse.success(topology, "Tải bản đồ mạng lưới logistics thành công"));
    }
}

package vn.rikkei.post.dto.network;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkTopologyNodeResponse {
    private Long id;
    private String code;
    private String name;
    private String type; // REGIONAL_HUB, HUB, SPOKE_POST_OFFICE
    private String typeDescription;
    private Integer provinceId;
    private String provinceName;
    private Integer districtId;
    private String address;
    private Double latitude;
    private Double longitude;
    private Integer capacityPackages;
    private Long pendingBagsCount;
    private Long availableTrucksCount;
    private Long incomingDispatchesCount;
    private Boolean isActive;
}

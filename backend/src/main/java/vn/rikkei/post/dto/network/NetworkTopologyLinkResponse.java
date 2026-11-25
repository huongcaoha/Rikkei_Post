package vn.rikkei.post.dto.network;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkTopologyLinkResponse {
    private String id;
    private Long fromWarehouseId;
    private String fromWarehouseName;
    private String fromWarehouseCode;
    private Double fromLat;
    private Double fromLng;
    private Long toWarehouseId;
    private String toWarehouseName;
    private String toWarehouseCode;
    private Double toLat;
    private Double toLng;
    private String linkType; // REGIONAL_BACKBONE, FEEDER_HUB, LAST_MILE_SPOKE
    private String linkDescription;
    private Double distanceKm;
    private Integer activeTransitsCount;
}

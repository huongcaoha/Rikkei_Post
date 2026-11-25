package vn.rikkei.post.dto.network;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkTopologyResponse {
    private List<NetworkTopologyNodeResponse> nodes;
    private List<NetworkTopologyLinkResponse> links;
    private List<NetworkActiveTruckResponse> activeTrucks;
    private int totalRegionalHubs;
    private int totalHubs;
    private int totalSpokes;
    private int totalLinks;
    private int totalActiveTrucks;
    private int totalBagsInTransit;
}

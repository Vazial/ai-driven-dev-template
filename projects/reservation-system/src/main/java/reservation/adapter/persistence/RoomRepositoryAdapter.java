package reservation.adapter.persistence;

import java.util.Optional;
import org.springframework.stereotype.Repository;
import reservation.application.RoomRepository;
import reservation.domain.Room;

/** RoomRepositoryポートのJPA実装。 */
@Repository
public class RoomRepositoryAdapter implements RoomRepository {

    private final RoomSpringDataRepository springDataRepository;

    public RoomRepositoryAdapter(RoomSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<Room> findById(String roomId) {
        return springDataRepository.findById(roomId).map(entity -> new Room(
                entity.getId(),
                entity.getName(),
                entity.getBusinessHoursStart(),
                entity.getBusinessHoursEnd(),
                entity.getCapacity()));
    }
}

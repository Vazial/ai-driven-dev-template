package reservation.adapter.persistence;

import java.util.List;
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
        return springDataRepository.findById(roomId).map(RoomRepositoryAdapter::toDomain);
    }

    @Override
    public List<Room> findAll() {
        return springDataRepository.findAll().stream()
                .map(RoomRepositoryAdapter::toDomain)
                .toList();
    }

    @Override
    public Optional<Room> findByName(String name) {
        return springDataRepository.findByName(name).map(RoomRepositoryAdapter::toDomain);
    }

    @Override
    public Room save(Room room) {
        RoomJpaEntity saved = springDataRepository.save(new RoomJpaEntity(
                room.id(), room.name(), room.businessHoursStart(), room.businessHoursEnd(), room.capacity()));
        return toDomain(saved);
    }

    private static Room toDomain(RoomJpaEntity entity) {
        return new Room(
                entity.getId(),
                entity.getName(),
                entity.getBusinessHoursStart(),
                entity.getBusinessHoursEnd(),
                entity.getCapacity());
    }
}

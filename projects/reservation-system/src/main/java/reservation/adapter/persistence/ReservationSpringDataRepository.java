package reservation.adapter.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data JPAの内部リポジトリ。ポート実装(ReservationRepositoryAdapter)とテスト用seamのみが使う。 */
public interface ReservationSpringDataRepository extends JpaRepository<ReservationJpaEntity, UUID> {

    List<ReservationJpaEntity> findByRoomIdAndDateAndCancelledAtIsNull(String roomId, LocalDate date);
}

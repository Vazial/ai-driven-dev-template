package reservation.adapter.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data JPAの内部リポジトリ。ポート実装(RoomRepositoryAdapter)とテスト用seamのみが使う。 */
public interface RoomSpringDataRepository extends JpaRepository<RoomJpaEntity, String> {

    Optional<RoomJpaEntity> findByName(String name);
}

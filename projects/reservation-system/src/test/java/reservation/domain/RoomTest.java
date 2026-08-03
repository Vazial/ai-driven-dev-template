package reservation.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/**
 * L1: Room.register(会議室登録)の単体テスト。
 * 契約対応: RSV-T-01(登録できる) / RSV-T-03(終了が開始より前) / RSV-T-04(終了と開始が同時刻)。
 * 表示名の重複(RSV-T-02)はリポジトリ問い合わせが要るためRoomRegistrationServiceTestが担う。
 */
class RoomTest {

    @Test
    void RSV_T_01_名前_営業時間_定員を指定して会議室を登録できる() {
        Room room = Room.register("会議室C", LocalTime.of(9, 0), LocalTime.of(18, 0), 8);

        assertThat(room.id()).isNotBlank();
        assertThat(room.name()).isEqualTo("会議室C");
        assertThat(room.businessHoursStart()).isEqualTo(LocalTime.of(9, 0));
        assertThat(room.businessHoursEnd()).isEqualTo(LocalTime.of(18, 0));
        assertThat(room.capacity()).isEqualTo(8);
    }

    @Test
    void 登録するたびに異なるIDがサーバ採番される() {
        Room first = Room.register("会議室C", LocalTime.of(9, 0), LocalTime.of(18, 0), 8);
        Room second = Room.register("会議室D", LocalTime.of(9, 0), LocalTime.of(18, 0), 8);

        assertThat(first.id()).isNotEqualTo(second.id());
    }

    @Test
    void RSV_T_03_終了が開始より前の営業時間はINVALID_BUSINESS_HOURSで拒否される() {
        assertThatThrownBy(() ->
                Room.register("会議室D", LocalTime.of(18, 0), LocalTime.of(9, 0), 6))
                .isInstanceOfSatisfying(RoomRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RoomRejectionReason.INVALID_BUSINESS_HOURS));
    }

    @Test
    void RSV_T_04_終了と開始が同時刻の営業時間はINVALID_BUSINESS_HOURSで拒否される() {
        assertThatThrownBy(() ->
                Room.register("会議室D", LocalTime.of(9, 0), LocalTime.of(9, 0), 6))
                .isInstanceOfSatisfying(RoomRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RoomRejectionReason.INVALID_BUSINESS_HOURS));
    }

    @Test
    void 拒否理由は人間が読める説明文を持つ() {
        assertThatThrownBy(() ->
                Room.register("会議室D", LocalTime.of(9, 0), LocalTime.of(9, 0), 6))
                .isInstanceOf(RoomRejectedException.class)
                .hasMessage("営業時間の終了時刻は開始時刻より後でなければなりません");
    }
}

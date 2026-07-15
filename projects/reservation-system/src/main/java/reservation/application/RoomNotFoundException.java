package reservation.application;

/** 指定された会議室が存在しない。契約に定義のない異常系であり、adapter/apiが404に翻訳する。 */
public class RoomNotFoundException extends RuntimeException {

    public RoomNotFoundException(String roomId) {
        super("会議室が見つかりません: " + roomId);
    }
}

from uuid import UUID


def test_request_id_header_present(client):
    response = client.get("/health")
    assert response.status_code == 200
    request_id = response.headers.get("x-request-id")
    assert request_id is not None
    UUID(request_id)


def test_request_id_is_unique_per_request(client):
    first = client.get("/health")
    second = client.get("/health")
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.headers.get("x-request-id") != second.headers.get("x-request-id")

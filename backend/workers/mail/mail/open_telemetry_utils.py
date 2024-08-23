import logging
import os

from opentelemetry import trace, metrics
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

OTEL_URL = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "otel-collector:4317")


def instrument_worker(
    service_name: str,
    otel_collector_endpoint: str = "http://" + OTEL_URL,
    httpx: bool = True,
    requests: bool = False,
):
    """
    Instrument a FastAPI app with OpenTelemetry.
    """

    if httpx:
        HTTPXClientInstrumentor().instrument()

    if requests:
        RequestsInstrumentor().instrument()

    resource = Resource(attributes={SERVICE_NAME: service_name})

    # tracing
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=otel_collector_endpoint))
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(processor)
    trace.set_tracer_provider(tracer_provider)

    # logging
    LoggingInstrumentor(set_logging_format=True, tracer_provider=tracer_provider).instrument()
    # log provider, exporter and handler
    logger_provider = LoggerProvider(resource=resource)
    set_logger_provider(logger_provider)
    log_exporter = OTLPLogExporter(endpoint=otel_collector_endpoint)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    log_handler = LoggingHandler(level=logging.NOTSET, logger_provider=logger_provider)
    # attaching OTLP handler to the root logger
    logging.getLogger().addHandler(log_handler)

    # metrics
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=otel_collector_endpoint),
    )
    metric_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(metric_provider)
